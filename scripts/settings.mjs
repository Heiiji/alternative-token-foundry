/**
 * Setting + GM-only menu registration. Called once during `init`.
 */

import { AtfConfigApp } from "./config-app.mjs";
import { DEFAULT_CONFIG, MODULE_ID, SETTINGS } from "./constants.mjs";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.CONFIG, {
    scope: "world",
    config: false,
    type: Object,
    default: foundry.utils.deepClone(DEFAULT_CONFIG),
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
