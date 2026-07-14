/**
 * Shared constants and tiny helpers.
 *
 * This module must never touch Foundry globals (`game`, `foundry`, `ui`, `CONST`)
 * at import time — only inside function bodies — so the pure logic that imports it
 * stays unit-testable under Node/vitest.
 */

export const MODULE_ID = "alternative-token-foundry";

/** World-setting keys. */
export const SETTINGS = {
  CONFIG: "actorConfigurations",
};

/** Actor flag keys (namespaced under `flags[MODULE_ID]`). */
export const FLAGS = {
  REQUEST: "request",
  LAST_RESULT: "lastResult",
};

/** The two appearance slots. */
export const SLOTS = { A: "a", B: "b" };

/** Supported art modes. */
export const ART_MODES = { STANDARD: "standard", RING: "ring-subject" };

export const SCHEMA_VERSION = 1;

/** A switch request older than this (ms) is rejected as stale. */
export const REQUEST_TTL_MS = 15_000;

/**
 * Marker placed on the `options` object of every document update the module
 * performs itself, so the module's own update hooks can ignore them (anti-loop).
 */
export const INTERNAL_OPTION = "atfInternal";

export const DEFAULT_CONFIG = { schemaVersion: SCHEMA_VERSION, actors: {} };

/**
 * Localize + format a key. Safe to call outside Foundry (returns the key).
 * @param {string} key   Either a bare key ("hud.noGM") or fully-qualified ("ATF.hud.noGM").
 * @param {object} [data]
 */
export function t(key, data = {}) {
  const g = typeof game !== "undefined" ? game : null;
  const full = key.startsWith("ATF.") ? key : `ATF.${key}`;
  return g?.i18n?.format ? g.i18n.format(full, data) : full;
}

export function log(...args) {
  console.log(`${MODULE_ID} |`, ...args);
}
export function warn(...args) {
  console.warn(`${MODULE_ID} |`, ...args);
}
export function error(...args) {
  console.error(`${MODULE_ID} |`, ...args);
}
