/**
 * Applies an appearance to every linked token (across all scenes) and the actor's
 * prototype token, with best-effort rollback. Only the image field is touched —
 * scale, dimensions, vision, tint, bars, ring colors and all system data are left
 * exactly as they are, and the Actor sheet portrait is never changed.
 */

import { appearanceUpdateOptions } from "./animation.mjs";
import { INTERNAL_OPTION, error } from "./constants.mjs";
import { getActorConfig } from "./config-repository.mjs";
import { activeField, resolveActiveSlot } from "./slots.mjs";
import { samePath } from "./paths.mjs";
import { buildPrototypeUpdate, planRollback, planSceneUpdates } from "./sync-plan.mjs";

/**
 * Switch an actor to the given slot everywhere.
 * @param {Actor} actor
 * @param {object} config  the actor's configuration
 * @param {"a"|"b"} slot
 */
export async function synchronizeAppearance(actor, config, slot) {
  const artMode = config.artMode;
  const field = activeField(artMode);
  const src = config[slot]?.src;
  if (!src) throw new Error(`${actor?.name}: target slot "${slot}" has no image`);

  // Keep only tokens that still exist in their scene: a stale dependent-token
  // entry (deleted token) would make the whole batch update reject.
  const tokenDocs = (actor.getDependentTokens({ linked: true }) ?? []).filter(
    (td) => td?.parent?.id && (td.parent.tokens?.has(td.id) ?? true),
  );

  // Snapshot current values for rollback.
  const snapshot = {
    prototypeSrc: foundry.utils.getProperty(actor.prototypeToken, field),
    tokens: tokenDocs.map((td) => ({
      id: td.id,
      sceneId: td.parent.id,
      src: foundry.utils.getProperty(td, field),
    })),
  };

  const sceneUpdates = planSceneUpdates(
    tokenDocs.map((td) => ({ id: td.id, sceneId: td.parent.id })),
    artMode,
    src,
  );

  try {
    for (const [sceneId, updates] of sceneUpdates) {
      const scene = game.scenes.get(sceneId);
      if (scene && updates.length) {
        await scene.updateEmbeddedDocuments("Token", updates, appearanceUpdateOptions());
      }
    }
    await actor.update(buildPrototypeUpdate(artMode, src), { [INTERNAL_OPTION]: true });
  } catch (err) {
    await rollbackAppearance(actor, snapshot, artMode);
    throw err;
  }
}

async function rollbackAppearance(actor, snapshot, artMode) {
  try {
    for (const [sceneId, updates] of planRollback(snapshot.tokens, artMode)) {
      const scene = game.scenes.get(sceneId);
      if (scene && updates.length) {
        await scene.updateEmbeddedDocuments("Token", updates, appearanceUpdateOptions({ animate: false }));
      }
    }
    if (snapshot.prototypeSrc != null) {
      await actor.update(buildPrototypeUpdate(artMode, snapshot.prototypeSrc), { [INTERNAL_OPTION]: true });
    }
  } catch (err) {
    error("rollback failed", err);
  }
}

/**
 * Switch a single (unlinked) placed token to the given slot. Each unlinked token
 * is independent, so only this token document changes — not the prototype or any
 * sibling tokens. Best-effort rollback on failure.
 * @param {TokenDocument} tokenDoc
 * @param {object} config
 * @param {"a"|"b"} slot
 */
export async function switchSingleToken(tokenDoc, config, slot) {
  const field = activeField(config.artMode);
  const src = config[slot]?.src;
  if (!src) throw new Error(`target slot "${slot}" has no image`);
  if (tokenDoc?.parent && !(tokenDoc.parent.tokens?.has(tokenDoc.id) ?? true)) {
    throw new Error(`token "${tokenDoc.name ?? tokenDoc.id}" no longer exists on its scene`);
  }

  const previous = foundry.utils.getProperty(tokenDoc, field);
  try {
    await tokenDoc.update({ [field]: src }, appearanceUpdateOptions());
  } catch (err) {
    if (previous != null) {
      await tokenDoc.update({ [field]: previous }, appearanceUpdateOptions({ animate: false })).catch(() => {});
    }
    throw err;
  }
}

/**
 * Bring a freshly-created linked token in line with the actor's active slot.
 * Called on the authoritative GM from the `createToken` hook. The prototype update
 * normally covers future tokens; this is belt-and-braces reconciliation.
 * @param {TokenDocument} tokenDoc
 */
export async function reconcileToken(tokenDoc) {
  const actor = tokenDoc?.actor;
  if (!actor || !tokenDoc.isLinked) return;

  const config = getActorConfig(actor.id);
  if (!config?.enabled || !config.a?.src || !config.b?.src) return;

  const field = activeField(config.artMode);
  const activeSrc = foundry.utils.getProperty(actor.prototypeToken, field);
  const slot = resolveActiveSlot(activeSrc, config);
  if (!slot) return; // out of sync — don't guess

  const desired = config[slot].src;
  const current = foundry.utils.getProperty(tokenDoc, field);
  if (samePath(current, desired)) return;

  await tokenDoc.update({ [field]: desired }, appearanceUpdateOptions({ animate: false }));
}
