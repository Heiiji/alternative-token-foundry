/**
 * Read/write access to the GM-only configuration (a hidden world setting).
 * Players can read it (they need labels for the button) but cannot write it,
 * which is what keeps approved image paths under GM control.
 */

import { DEFAULT_CONFIG, MODULE_ID, SCHEMA_VERSION, SETTINGS } from "./constants.mjs";

/** @returns {object} the whole configuration object (never null). */
export function getConfig() {
  const raw = game.settings.get(MODULE_ID, SETTINGS.CONFIG);
  if (!raw || typeof raw !== "object") return foundry.utils.deepClone(DEFAULT_CONFIG);
  if (!raw.actors) raw.actors = {};
  return raw;
}

/** @param {object} config */
export async function setConfig(config) {
  return game.settings.set(MODULE_ID, SETTINGS.CONFIG, config);
}

/**
 * @param {string} actorId
 * @returns {object | null}
 */
export function getActorConfig(actorId) {
  return getConfig().actors?.[actorId] ?? null;
}

/**
 * @param {string} actorId
 * @param {object} actorConfig
 */
export async function setActorConfig(actorId, actorConfig) {
  const cfg = foundry.utils.deepClone(getConfig());
  cfg.schemaVersion ??= SCHEMA_VERSION;
  cfg.actors ??= {};
  cfg.actors[actorId] = actorConfig;
  return setConfig(cfg);
}

/** @param {string} actorId */
export async function removeActorConfig(actorId) {
  const cfg = foundry.utils.deepClone(getConfig());
  if (cfg.actors?.[actorId]) {
    delete cfg.actors[actorId];
    return setConfig(cfg);
  }
  return undefined;
}
