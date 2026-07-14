/**
 * Pure slot / appearance-resolution helpers.
 *
 * The prototype token's image is the persistent source of truth for the active
 * appearance. Which *field* holds that image depends on the actor's art mode.
 */

import { ART_MODES, SLOTS } from "./constants.mjs";
import { samePath } from "./paths.mjs";

/**
 * The document field that holds the active image for a given art mode.
 * @param {string} artMode
 * @returns {"ring.subject.texture" | "texture.src"}
 */
export function activeField(artMode) {
  return artMode === ART_MODES.RING ? "ring.subject.texture" : "texture.src";
}

/**
 * The opposite slot.
 * @param {"a"|"b"} slot
 * @returns {"a"|"b"}
 */
export function otherSlot(slot) {
  return slot === SLOTS.B ? SLOTS.A : SLOTS.B;
}

/**
 * Resolve which configured slot the current image corresponds to.
 * @param {unknown} currentSrc  Value at the active field of the prototype token.
 * @param {{a?:{src?:string}, b?:{src?:string}}} config
 * @returns {"a" | "b" | null}  null = out of sync (matches neither slot).
 */
export function resolveActiveSlot(currentSrc, config) {
  if (!config) return null;
  if (samePath(currentSrc, config.a?.src)) return SLOTS.A;
  if (samePath(currentSrc, config.b?.src)) return SLOTS.B;
  return null;
}
