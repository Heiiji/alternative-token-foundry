/**
 * Alternative Token Foundry — entry point.
 *
 * Lets players switch their linked character token between two GM-approved
 * appearances with one click, keeping every linked token and the prototype token
 * in sync. See docs/DESIGN.md for the full design.
 */

import { FLAGS, INTERNAL_OPTION, MODULE_ID, log } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { getActorConfig } from "./config-repository.mjs";
import { isPrimaryActiveGM } from "./authority.mjs";
import { onRenderTokenHUD } from "./hud-controller.mjs";
import { reconcileToken, synchronizeAppearance } from "./sync-service.mjs";
import {
  handleRelayedRequest,
  notifyRequester,
  recoverPendingRequests,
  requestAppearanceChange,
} from "./request-service.mjs";

Hooks.once("init", () => {
  registerSettings();
  log("initialized");
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = { requestAppearanceChange, synchronizeAppearance, getActorConfig };
    Hooks.callAll(`${MODULE_ID}.ready`, mod.api);
  }
  recoverPendingRequests().catch((err) => console.error(`${MODULE_ID} |`, err));
});

Hooks.on("renderTokenHUD", (hud, element) => {
  try {
    onRenderTokenHUD(hud, element);
  } catch (err) {
    console.error(`${MODULE_ID} |`, err);
  }
});

Hooks.on("updateActor", (actor, changed, options, userId) => {
  if (options?.[INTERNAL_OPTION]) return;

  // GM side: a player wrote a request flag.
  const request = foundry.utils.getProperty(changed, `flags.${MODULE_ID}.${FLAGS.REQUEST}`);
  if (request) handleRelayedRequest(actor, request, userId);

  // Any client: show the requesting user their result.
  const result = foundry.utils.getProperty(changed, `flags.${MODULE_ID}.${FLAGS.LAST_RESULT}`);
  if (result) notifyRequester(result);
});

Hooks.on("createToken", (tokenDoc, options) => {
  if (options?.[INTERNAL_OPTION]) return;
  if (!isPrimaryActiveGM()) return;
  reconcileToken(tokenDoc).catch((err) => console.error(`${MODULE_ID} |`, err));
});

Hooks.on("userConnected", () => {
  // Authority may have shifted; a newly-elected GM picks up pending requests.
  recoverPendingRequests().catch((err) => console.error(`${MODULE_ID} |`, err));
});
