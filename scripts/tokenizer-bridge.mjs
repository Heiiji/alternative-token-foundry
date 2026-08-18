/**
 * Optional Tokenizer (vtta-tokenizer) integration.
 *
 * Tokenizer is an image factory: ATF launches it per slot with a custom callback
 * and never runs Tokenizer's default `updateActor` (portrait, ring, scale, current
 * scene only). Pure helpers in this file stay free of Foundry globals at import
 * time so they remain unit-testable.
 */

import { SLOTS, t, error, withErrorDetail } from "./constants.mjs";
import { normalizePath, samePath } from "./paths.mjs";

export const TOKENIZER_MODULE_ID = "vtta-tokenizer";
export const TOKENIZER_APP_ID = "tokenizer-control";

/**
 * Filename suffix Tokenizer appends: `{slug}.Token{suffix}.{ext}`.
 * Actor id is required so two characters with the same name cannot share a file.
 * @param {string} actorId
 * @param {"a"|"b"} slot
 */
export function atfNameSuffix(actorId, slot) {
  return `.atf.${actorId}.${slot}`;
}

/**
 * Map a Foundry actor type to Tokenizer's pc/npc upload folders.
 * @param {string} [actorType]
 * @returns {"pc"|"npc"}
 */
export function tokenizerActorType(actorType) {
  return actorType === "character" || actorType === "pc" ? "pc" : "npc";
}

/**
 * After a successful slot tokenize, only sync the canvas when that slot is
 * already showing. Hidden-slot and out-of-sync never surprise-switch.
 * @param {"a"|"b"|null} activeSlot
 * @param {"a"|"b"} tokenizedSlot
 * @param {boolean} outOfSync
 */
export function shouldSyncAfterTokenize(activeSlot, tokenizedSlot, outOfSync) {
  if (outOfSync) return false;
  return activeSlot === tokenizedSlot;
}

/**
 * True when the uploaded basename contains ATF's per-slot suffix.
 * @param {unknown} tokenFilename
 * @param {string} actorId
 * @param {"a"|"b"} slot
 */
export function tokenBasenameHasAtfSuffix(tokenFilename, actorId, slot) {
  const path = normalizePath(tokenFilename);
  const base = path.split("/").pop() ?? "";
  const suffix = atfNameSuffix(actorId, slot);
  return suffix.length > 0 && base.includes(suffix);
}

/**
 * Tokenizer Apply with "Modify Token" off leaves the seed path unchanged and
 * without our suffix — that is a no-op. Re-tokenizing the same ATF file keeps
 * the path but still counts as a real save (caller cache-busts the canvas).
 * @param {unknown} tokenFilename
 * @param {unknown} seedFilename
 * @param {string} actorId
 * @param {"a"|"b"} slot
 */
export function tokenizerResultIsNoop(tokenFilename, seedFilename, actorId, slot) {
  if (!tokenFilename || typeof tokenFilename !== "string") return true;
  if (tokenBasenameHasAtfSuffix(tokenFilename, actorId, slot)) return false;
  return samePath(tokenFilename, seedFilename);
}

/**
 * Options object passed to Tokenizer.launch. Omits `actor` / `token` so a
 * mistaken default callback cannot rewrite documents.
 * @param {object} p
 */
export function buildTokenizerLaunchOptions({
  name,
  type,
  disposition,
  tokenFilename,
  avatarFilename,
  actorId,
  slot,
  otherSlotSrc = "",
}) {
  const seed = tokenFilename || undefined;
  return {
    name,
    type,
    disposition,
    tokenFilename: seed,
    avatarFilename,
    isWildCard: false,
    nameSuffix: atfNameSuffix(actorId, slot),
    atfActorId: actorId,
    atfSlot: slot,
    atfSeedTokenFilename: tokenFilename ?? "",
    atfOtherSlotSrc: otherSlotSrc ?? "",
  };
}

/**
 * Interpret Tokenizer's callback payload. Does not write documents.
 * @param {object} response
 * @returns {{ok:true, src:string, actorId:string, slot:"a"|"b"} | {ok:false, reason:string}}
 */
export function parseTokenizerResponse(response) {
  if (!response || typeof response !== "object") {
    return { ok: false, reason: "ATF.notify.tokenizerNoop" };
  }
  const actorId = response.atfActorId;
  const slot = response.atfSlot;
  if (slot !== SLOTS.A && slot !== SLOTS.B) {
    return { ok: false, reason: "ATF.notify.tokenizerNoop" };
  }
  if (tokenizerResultIsNoop(response.tokenFilename, response.atfSeedTokenFilename, actorId, slot)) {
    return { ok: false, reason: "ATF.notify.tokenizerNoop" };
  }
  const src = normalizePath(response.tokenFilename);
  if (!src) return { ok: false, reason: "ATF.notify.tokenizerNoop" };
  if (samePath(src, response.atfOtherSlotSrc)) {
    return { ok: false, reason: "ATF.errors.imagesMustDiffer" };
  }
  return { ok: true, src, actorId, slot };
}

/** Tokenizer is active, exposes launch, and this client is a GM who can upload. */
export function isTokenizerAvailable() {
  const g = typeof game !== "undefined" ? game : null;
  if (!g?.user?.isGM) return false;
  if (!g.user.can?.("FILES_UPLOAD")) return false;
  const mod = g.modules?.get?.(TOKENIZER_MODULE_ID);
  if (!mod?.active) return false;
  const launch = mod.api?.launch ?? globalThis.Tokenizer?.launch;
  return typeof launch === "function";
}

export function isTokenizerOpen() {
  return !!foundry?.applications?.instances?.get?.(TOKENIZER_APP_ID);
}

function getTokenizerApi() {
  return game.modules.get(TOKENIZER_MODULE_ID)?.api ?? globalThis.Tokenizer ?? null;
}

/**
 * Open Tokenizer for one ATF slot. Success is delivered only via `onResult`
 * after the GM presses Apply. Cancel/close never calls back.
 * @returns {boolean} true if Tokenizer was launched
 */
export function launchSlotTokenizer({ actor, slot, seedSrc, otherSlotSrc, onResult }) {
  if (!isTokenizerAvailable()) {
    ui.notifications?.warn(t("ATF.errors.tokenizerUnavailable"));
    return false;
  }
  if (isTokenizerOpen()) {
    ui.notifications?.warn(t("ATF.errors.tokenizerOpen"));
    return false;
  }
  const api = getTokenizerApi();
  if (typeof api?.launch !== "function") {
    ui.notifications?.warn(t("ATF.errors.tokenizerUnavailable"));
    return false;
  }

  const options = buildTokenizerLaunchOptions({
    name: actor.name,
    type: tokenizerActorType(actor.type),
    disposition: actor.prototypeToken?.disposition,
    tokenFilename: seedSrc || undefined,
    avatarFilename: actor.img,
    actorId: actor.id,
    slot,
    otherSlotSrc,
  });

  api.launch(options, (response) => {
    try {
      const parsed = parseTokenizerResponse(response);
      const result = onResult?.(parsed);
      if (result && typeof result.then === "function") {
        result.catch((err) => {
          error(err);
          ui.notifications?.error(withErrorDetail(t("ATF.errors.syncFailed"), err));
        });
      }
    } catch (err) {
      error(err);
      ui.notifications?.error(withErrorDetail(t("ATF.errors.syncFailed"), err));
    }
  });
  return true;
}
