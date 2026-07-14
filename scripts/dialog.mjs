/**
 * The out-of-sync fallback dialog. Only shown when a token's current art matches
 * neither configured slot, so the user must pick one explicitly.
 */

import { SLOTS, t } from "./constants.mjs";

/**
 * @param {object} config  the actor's configuration
 * @returns {Promise<"a"|"b"|null>}
 */
export async function promptSlotChoice(config) {
  const DialogV2 = foundry.applications.api.DialogV2;
  try {
    const choice = await DialogV2.wait({
      window: { title: t("ATF.dialog.outOfSyncTitle"), icon: "fa-solid fa-masks-theater" },
      content: `<p>${t("ATF.dialog.outOfSyncContent")}</p>`,
      buttons: [
        { action: SLOTS.A, label: config.a?.label || "A", default: true },
        { action: SLOTS.B, label: config.b?.label || "B" },
      ],
      rejectClose: false,
    });
    return choice === SLOTS.A || choice === SLOTS.B ? choice : null;
  } catch {
    return null;
  }
}
