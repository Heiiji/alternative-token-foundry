/**
 * Injects Token HUD controls:
 *  - a GM-only *edit* button (configure this token's two images), shown whenever the
 *    token has a world actor, regardless of config state;
 *  - a *switch* button for owners, shown only when a config is enabled with both images.
 */

import { t, error } from "./constants.mjs";
import { getActorConfig } from "./config-repository.mjs";
import { getPrimaryActiveGMId } from "./authority.mjs";
import { activeField, otherSlot, resolveActiveSlot } from "./slots.mjs";
import { requestAppearanceChange } from "./request-service.mjs";
import { promptSlotChoice } from "./dialog.mjs";
import { AtfConfigApp } from "./config-app.mjs";

/**
 * `renderTokenHUD` handler. In V13/V14 `element` is a native HTMLElement.
 * @param {Application} hud
 * @param {HTMLElement} element
 */
export function onRenderTokenHUD(hud, element) {
  const token = hud?.object;
  const actor = token?.actor;
  const tokenDoc = token?.document;
  if (!actor || !tokenDoc) return;

  const column =
    element.querySelector(".col.right") ||
    element.querySelector(".col.left") ||
    element.querySelector(".right") ||
    element.querySelector(".left") ||
    element;

  // GM edit button — lets the GM configure the two images straight from the table.
  // Requires a real world actor to key the (GM-only) config on.
  if (game.user.isGM && game.actors.has(actor.id)) {
    column.appendChild(buildEditButton(actor.id));
  }

  // Switch button — owners only, and only when fully configured.
  if (!actor.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) return;

  const config = getActorConfig(actor.id);
  if (!config?.enabled || !config.a?.src || !config.b?.src) return;

  const field = activeField(config.artMode);
  // Source of truth: the prototype for linked tokens (character-level), the token
  // itself for unlinked tokens (each unlinked token is independent).
  const activeSrc = tokenDoc.isLinked
    ? foundry.utils.getProperty(actor.prototypeToken, field)
    : foundry.utils.getProperty(tokenDoc, field);
  const active = resolveActiveSlot(activeSrc, config);
  const target = active ? otherSlot(active) : null;

  const button = buildButton(config, active, target);
  column.appendChild(button);

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    if (button.classList.contains("atf-disabled")) return;

    let slot = target;
    if (!active) {
      slot = await promptSlotChoice(config);
      if (!slot) return;
    }
    await doSwitch(actor, slot, button, tokenDoc.uuid);
  });
}

function buildEditButton(actorId) {
  const button = document.createElement("div");
  button.classList.add("control-icon", "atf-edit");
  button.innerHTML = `<i class="fa-solid fa-pen-to-square fa-fw"></i>`;
  button.dataset.tooltip = t("ATF.hud.editImages");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    AtfConfigApp.openForActor(actorId);
  });
  return button;
}

function buildButton(config, active, target) {
  const button = document.createElement("div");
  button.classList.add("control-icon", "atf-switch");

  const noGM = getPrimaryActiveGMId() == null;
  let iconClass = "fa-solid fa-masks-theater";
  let tooltip;

  if (!active) {
    iconClass = "fa-solid fa-triangle-exclamation";
    button.classList.add("atf-warn");
    tooltip = t("ATF.hud.outOfSync");
  } else {
    tooltip = t("ATF.hud.switchTo", { label: config[target].label });
  }

  if (noGM) {
    button.classList.add("atf-disabled");
    tooltip = t("ATF.hud.noGM");
  }

  button.innerHTML = `<i class="${iconClass} fa-fw"></i>`;
  button.dataset.tooltip = tooltip;
  return button;
}

async function doSwitch(actor, slot, button, tokenUuid) {
  const icon = button.querySelector("i");
  const prevIcon = icon?.className;
  button.classList.add("atf-processing");
  if (icon) icon.className = "fa-solid fa-spinner fa-spin fa-fw";

  try {
    const result = await requestAppearanceChange(actor, slot, tokenUuid);
    // GM fast-path returns a result directly; relayed requests notify via flag.
    if (result && !result.success) {
      ui.notifications?.warn(t(result.message ?? "ATF.errors.switchFailed"));
    } else if (result?.success) {
      ui.notifications?.info(t("ATF.notify.switched"));
    }
  } catch (err) {
    error(err);
    ui.notifications?.error(t("ATF.errors.switchFailed"));
  } finally {
    button.classList.remove("atf-processing");
    if (icon && prevIcon) icon.className = prevIcon;
  }
}
