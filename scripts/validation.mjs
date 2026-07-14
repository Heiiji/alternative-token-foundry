/**
 * Pure validation helpers. Return i18n *keys* (strings) rather than localized
 * text, so they can run and be tested outside Foundry.
 */

import { REQUEST_TTL_MS, SLOTS } from "./constants.mjs";

/**
 * Validate a per-actor configuration for saving.
 * @param {object} cfg  { a:{label,src}, b:{label,src}, ... }
 * @returns {string[]}  i18n keys of errors (empty array = valid).
 */
export function validateActorConfig(cfg) {
  if (!cfg) return ["ATF.errors.noConfig"];

  const errors = [];
  const aSrc = cfg.a?.src;
  const bSrc = cfg.b?.src;

  if (!aSrc) errors.push("ATF.errors.imageARequired");
  if (!bSrc) errors.push("ATF.errors.imageBRequired");
  if (aSrc && bSrc && aSrc === bSrc) errors.push("ATF.errors.imagesMustDiffer");
  if (!cfg.a?.label || !String(cfg.a.label).trim()) errors.push("ATF.errors.labelARequired");
  if (!cfg.b?.label || !String(cfg.b.label).trim()) errors.push("ATF.errors.labelBRequired");

  return errors;
}

/**
 * Validate a switch request on the authoritative GM before applying it.
 * All inputs are plain facts computed by the caller (keeps this pure).
 *
 * @param {object}  p
 * @param {boolean} p.enabled      Config exists and is enabled.
 * @param {boolean} p.ownsActor    The attributed user owns the actor.
 * @param {string}  p.target       Requested slot.
 * @param {number}  p.requestedAt  Timestamp the request was created (ms).
 * @param {number}  p.now          Current time (ms).
 * @param {boolean} p.hasImage     The target slot has an image configured.
 * @param {number}  [p.ttl]        Max age in ms (defaults to REQUEST_TTL_MS).
 * @returns {{ok:true} | {ok:false, error:string}}
 */
export function validateSwitchRequest({ enabled, ownsActor, target, requestedAt, now, hasImage, ttl = REQUEST_TTL_MS }) {
  if (!enabled) return { ok: false, error: "ATF.errors.notEnabled" };
  if (!ownsActor) return { ok: false, error: "ATF.errors.notOwner" };
  if (target !== SLOTS.A && target !== SLOTS.B) return { ok: false, error: "ATF.errors.invalidTarget" };
  if (typeof requestedAt !== "number" || now - requestedAt > ttl) return { ok: false, error: "ATF.errors.expired" };
  if (!hasImage) return { ok: false, error: "ATF.errors.noImage" };
  return { ok: true };
}
