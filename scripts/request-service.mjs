/**
 * The player -> GM request pipeline.
 *
 * A player owns their actor, so they write a small, path-free `request` flag. The
 * `updateActor` hook then delivers that request to every client with a
 * server-verified initiator id; only the elected primary GM acts on it. If the
 * clicking user *is* the primary GM, we skip the round-trip and apply directly.
 *
 * All processing for a given actor goes through a per-actor promise queue so
 * concurrent / rapid requests can never overlap.
 */

import { FLAGS, MODULE_ID, REQUEST_TTL_MS, t, warn, error } from "./constants.mjs";
import { getActorConfig } from "./config-repository.mjs";
import { validateSwitchRequest } from "./validation.mjs";
import { synchronizeAppearance } from "./sync-service.mjs";
import { isPrimaryActiveGM } from "./authority.mjs";

// ---------------------------------------------------------------------------
// Per-actor serialization
// ---------------------------------------------------------------------------

const actorQueues = new Map();

/**
 * Chain `taskFn` after any in-flight work for this actor.
 * @param {string} actorId
 * @param {() => Promise<any>} taskFn
 */
export function enqueue(actorId, taskFn) {
  const prev = actorQueues.get(actorId) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(() => taskFn());
  const tracked = run.finally(() => {
    if (actorQueues.get(actorId) === tracked) actorQueues.delete(actorId);
  });
  actorQueues.set(actorId, tracked);
  return run;
}

// De-dupe: never process the same request id twice (hook double-fire / recovery race).
const processedRequestIds = new Set();

function markProcessed(id) {
  processedRequestIds.add(id);
  if (processedRequestIds.size > 500) {
    processedRequestIds.delete(processedRequestIds.values().next().value);
  }
}

// ---------------------------------------------------------------------------
// Player side
// ---------------------------------------------------------------------------

/**
 * Request that `actor` switch to `target`. Resolves to a result object when we
 * processed it locally (GM fast-path), or `undefined` when it was relayed.
 * @param {Actor} actor
 * @param {"a"|"b"} target
 */
export async function requestAppearanceChange(actor, target) {
  const request = {
    id: foundry.utils.randomID(),
    target,
    requestedAt: Date.now(),
    requesterId: game.user.id, // used only for post-handover recovery; re-checked for ownership
  };

  if (isPrimaryActiveGM()) {
    return enqueue(actor.id, () => processRequest(actor, request, game.user.id, { viaRelay: false }));
  }

  await actor.setFlag(MODULE_ID, FLAGS.REQUEST, request);
  return undefined;
}

// ---------------------------------------------------------------------------
// GM side
// ---------------------------------------------------------------------------

/**
 * Handle a `request` flag change observed on the authoritative GM.
 * @param {Actor} actor
 * @param {object} request  the flag value
 * @param {string} userId   trusted initiator id from the updateActor hook
 */
export function handleRelayedRequest(actor, request, userId) {
  if (!request || !isPrimaryActiveGM()) return;
  enqueue(actor.id, () => processRequest(actor, request, userId, { viaRelay: true }));
}

/**
 * On `ready` / GM handover: pick up any non-expired pending requests.
 */
export async function recoverPendingRequests() {
  if (!isPrimaryActiveGM()) return;
  for (const actor of game.actors) {
    const request = actor.getFlag(MODULE_ID, FLAGS.REQUEST);
    if (!request) continue;

    if (Date.now() - (request.requestedAt ?? 0) > REQUEST_TTL_MS) {
      await actor.unsetFlag(MODULE_ID, FLAGS.REQUEST).catch(() => {});
      continue;
    }
    // No trusted live userId after a handover — fall back to the recorded requester,
    // which is re-validated for ownership before anything is applied.
    enqueue(actor.id, () => processRequest(actor, request, request.requesterId ?? null, { viaRelay: true }));
  }
}

async function processRequest(actor, request, userId, { viaRelay }) {
  if (!request?.id || processedRequestIds.has(request.id)) return undefined;
  markProcessed(request.id);

  const config = getActorConfig(actor.id);
  const user = userId ? game.users.get(userId) : null;
  const ownsActor = !!user && actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
  const target = request.target;
  const hasImage = !!config?.[target]?.src;

  const check = validateSwitchRequest({
    enabled: !!config?.enabled,
    ownsActor,
    target,
    requestedAt: request.requestedAt,
    now: Date.now(),
    hasImage,
  });

  let result;
  if (!check.ok) {
    warn(`request rejected for "${actor?.name}":`, check.error);
    result = makeResult(request, userId, false, check.error);
  } else {
    try {
      await synchronizeAppearance(actor, config, target);
      result = makeResult(request, userId, true);
    } catch (err) {
      error("sync failed", err);
      result = makeResult(request, userId, false, "ATF.errors.syncFailed");
    }
  }

  if (viaRelay) await writeResultAndClear(actor, request, result);
  return result;
}

function makeResult(request, userId, success, message) {
  return {
    requestId: request.id,
    requesterId: request.requesterId ?? userId ?? null,
    success,
    ...(message ? { message } : {}),
    completedAt: Date.now(),
  };
}

async function writeResultAndClear(actor, request, result) {
  await actor.setFlag(MODULE_ID, FLAGS.LAST_RESULT, result).catch(() => {});
  const current = actor.getFlag(MODULE_ID, FLAGS.REQUEST);
  if (!current || current.id === request.id) {
    await actor.unsetFlag(MODULE_ID, FLAGS.REQUEST).catch(() => {});
  }
}

/**
 * Show a local toast to the requesting user based on a `lastResult` flag change.
 * @param {object} result
 */
export function notifyRequester(result) {
  if (!result || result.requesterId !== game.user.id) return;
  if (result.success) ui.notifications?.info(t("ATF.notify.switched"));
  else ui.notifications?.warn(t(result.message ?? "ATF.errors.switchFailed"));
}
