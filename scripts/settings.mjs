/**
 * Setting + GM-only menu registration. Called once during `init`.
 */

import { DEFAULT_TRANSITION, transitionSettingChoices } from "./animation.mjs";
import { AtfConfigApp } from "./config-app.mjs";
import { DEFAULT_CONFIG, MODULE_ID, SETTINGS } from "./constants.mjs";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.CONFIG, {
    scope: "world",
    config: false,
    type: Object,
    default: foundry.utils.deepClone(DEFAULT_CONFIG),
  });

  game.settings.register(MODULE_ID, SETTINGS.TRANSITION, {
    name: "ATF.settings.transitionName",
    hint: "ATF.settings.transitionHint",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_TRANSITION,
    choices: transitionSettingChoices(),
  });

  game.settings.registerMenu(MODULE_ID, "configMenu", {
    name: "ATF.settings.menuName",
    label: "ATF.settings.menuLabel",
    hint: "ATF.settings.menuHint",
    icon: "fas fa-masks-theater",
    type: AtfConfigApp,
    restricted: true, // GM only
  });
}
