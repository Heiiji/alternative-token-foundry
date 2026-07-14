/**
 * Pure planning for appearance synchronization. These functions build the plain
 * update objects Foundry expects, without performing any I/O — so the "what do we
 * write" decisions are unit-testable, while sync-service.mjs handles the "how".
 */

import { activeField } from "./slots.mjs";

/**
 * A single placed-token update object.
 * @param {string} tokenId
 * @param {string} artMode
 * @param {string} src
 */
export function buildTokenUpdate(tokenId, artMode, src) {
  return { _id: tokenId, [activeField(artMode)]: src };
}

/**
 * The prototype-token update object (Actor#update payload).
 * @param {string} artMode
 * @param {string} src
 */
export function buildPrototypeUpdate(artMode, src) {
  return { [`prototypeToken.${activeField(artMode)}`]: src };
}

/**
 * Group per-token updates by scene id.
 * @param {Array<{id:string, sceneId:string}>} tokens
 * @param {string} artMode
 * @param {string} src
 * @returns {Map<string, object[]>}  sceneId -> token update objects
 */
export function planSceneUpdates(tokens, artMode, src) {
  const bySceneId = new Map();
  for (const tk of tokens ?? []) {
    if (!tk || tk.sceneId == null) continue;
    if (!bySceneId.has(tk.sceneId)) bySceneId.set(tk.sceneId, []);
    bySceneId.get(tk.sceneId).push(buildTokenUpdate(tk.id, artMode, src));
  }
  return bySceneId;
}

/**
 * Build the scene updates that restore a captured snapshot (rollback).
 * @param {Array<{id:string, sceneId:string, src:string}>} snapshotTokens
 * @param {string} artMode
 * @returns {Map<string, object[]>}
 */
export function planRollback(snapshotTokens, artMode) {
  const bySceneId = new Map();
  for (const tk of snapshotTokens ?? []) {
    if (!tk || tk.sceneId == null) continue;
    if (!bySceneId.has(tk.sceneId)) bySceneId.set(tk.sceneId, []);
    bySceneId.get(tk.sceneId).push(buildTokenUpdate(tk.id, artMode, tk.src));
  }
  return bySceneId;
}
