/**
 * Token appearance-transition helpers.
 *
 * The supported names match Foundry V13/V14 `TokenAnimationTransition`
 * (`TextureTransitionFilter.TYPES`). This module stays free of Foundry globals
 * at import time so the resolver and options builder remain unit-testable.
 */

import { INTERNAL_OPTION, MODULE_ID, SETTINGS } from "./constants.mjs";

/** Foundry's default texture transition when `options.animation.transition` is omitted. */
export const DEFAULT_TRANSITION = "fade";

/**
 * Every texture-transition type Foundry documents for tokens.
 * `fade` is first so it appears first in the settings select.
 */
export const TOKEN_TRANSITIONS = Object.freeze([
  "fade",
  "crosshatch",
  "dots",
  "glitch",
  "hole",
  "holeSwirl",
  "hologram",
  "morph",
  "swirl",
  "waterDrop",
  "waves",
  "whiteNoise",
  "wind",
]);

/** @param {unknown} value */
export function isTokenTransition(value) {
  return typeof value === "string" && TOKEN_TRANSITIONS.includes(value);
}

/**
 * Coerce a stored setting (or anything else) to a Foundry-supported transition.
 * Unknown / empty values become fade so a corrupt world setting cannot break switches.
 * @param {unknown} value
 * @returns {string}
 */
export function resolveTransition(value) {
  return isTokenTransition(value) ? value : DEFAULT_TRANSITION;
}

/** Choices object for `game.settings.register` (`value → i18n key`). */
export function transitionSettingChoices() {
  return Object.fromEntries(TOKEN_TRANSITIONS.map((key) => [key, `ATF.transition.${key}`]));
}

/**
 * Read the GM-configured transition. Safe before settings exist (returns fade).
 * @returns {string}
 */
export function getConfiguredTransition() {
  const g = typeof game !== "undefined" ? game : null;
  try {
    return resolveTransition(g?.settings?.get?.(MODULE_ID, SETTINGS.TRANSITION));
  } catch {
    return DEFAULT_TRANSITION;
  }
}

/**
 * Options bag for Token document writes that change appearance.
 * Rollback / reconcile pass `{ animate: false }` so they do not play a second effect.
 * @param {{ animate?: boolean }} [opts]
 */
export function appearanceUpdateOptions({ animate = true } = {}) {
  const options = { [INTERNAL_OPTION]: true };
  if (!animate) {
    options.animate = false;
    return options;
  }
  options.animation = { transition: getConfiguredTransition() };
  return options;
}
