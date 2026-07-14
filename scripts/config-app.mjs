/**
 * GM configuration screen: pick two approved images + labels per player-owned
 * actor, choose art mode, enable/disable, and apply an appearance immediately.
 *
 * Built on ApplicationV2 + HandlebarsApplicationMixin (V14; FormApplication is
 * deprecated). Registered GM-only via settings.registerMenu({ restricted:true }).
 */

import { ART_MODES, MODULE_ID, t, error } from "./constants.mjs";
import { getConfig, removeActorConfig, setActorConfig, setConfig } from "./config-repository.mjs";
import { validateActorConfig } from "./validation.mjs";
import { synchronizeAppearance } from "./sync-service.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** World actors owned by at least one non-GM user (excludes synthetic/compendium actors). */
function eligibleActors() {
  return game.actors.filter(
    (a) =>
      !a.isToken &&
      !a.pack &&
      game.users.some((u) => !u.isGM && a.testUserPermission(u, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)),
  );
}

/** Seed config for an actor never configured before: prefill A with its current art. */
function defaultActorConfig(actor) {
  return {
    enabled: false,
    artMode: ART_MODES.STANDARD,
    a: { label: t("ATF.config.defaultLabelA"), src: actor.prototypeToken?.texture?.src ?? actor.img ?? "" },
    b: { label: t("ATF.config.defaultLabelB"), src: "" },
  };
}

export class AtfConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "atf-config",
    tag: "form",
    classes: ["atf-config"],
    window: { title: "ATF.settings.menuName", icon: "fas fa-masks-theater", resizable: true },
    position: { width: 760, height: "auto" },
    form: { handler: AtfConfigApp.#onSubmit, submitOnChange: false, closeOnSubmit: false },
    actions: {
      pickImage: AtfConfigApp.#onPickImage,
      useCurrent: AtfConfigApp.#onUseCurrent,
      applySlot: AtfConfigApp.#onApplySlot,
      removeActor: AtfConfigApp.#onRemoveActor,
    },
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/config.hbs`, scrollable: [".atf-actors"] },
  };

  async _prepareContext() {
    const cfg = getConfig();
    const artModes = [
      { value: ART_MODES.STANDARD, label: t("ATF.artMode.standard") },
      { value: ART_MODES.RING, label: t("ATF.artMode.ring") },
    ];

    const actors = eligibleActors()
      .map((actor) => {
        const stored = cfg.actors?.[actor.id];
        const ac = stored ?? defaultActorConfig(actor);
        return {
          id: actor.id,
          name: actor.name,
          img: actor.img,
          enabled: !!ac.enabled,
          artMode: ac.artMode ?? ART_MODES.STANDARD,
          a: { label: ac.a?.label ?? "", src: ac.a?.src ?? "" },
          b: { label: ac.b?.label ?? "", src: ac.b?.src ?? "" },
          artModes: artModes.map((m) => ({ ...m, selected: m.value === (ac.artMode ?? ART_MODES.STANDARD) })),
        };
      })
      .sort((x, y) => x.name.localeCompare(y.name));

    return { actors, hasActors: actors.length > 0 };
  }

  // --- form fields -> config -------------------------------------------------

  #readRow(actorId) {
    const q = (suffix) => this.element.querySelector(`[name="actors.${actorId}.${suffix}"]`);
    return {
      enabled: !!q("enabled")?.checked,
      artMode: q("artMode")?.value ?? ART_MODES.STANDARD,
      a: { label: q("a.label")?.value?.trim() ?? "", src: q("a.src")?.value?.trim() ?? "" },
      b: { label: q("b.label")?.value?.trim() ?? "", src: q("b.src")?.value?.trim() ?? "" },
    };
  }

  static async #onSubmit(_event, _form, formData) {
    const expanded = foundry.utils.expandObject(formData.object);
    const rows = expanded.actors ?? {};

    // Validate every enabled row before persisting anything.
    const errors = [];
    for (const [id, row] of Object.entries(rows)) {
      if (row.enabled) {
        for (const key of validateActorConfig(row)) {
          errors.push(`${game.actors.get(id)?.name ?? id}: ${t(key)}`);
        }
      }
    }
    if (errors.length) {
      ui.notifications?.error(errors[0]);
      return;
    }

    const cfg = foundry.utils.deepClone(getConfig());
    cfg.actors ??= {};
    for (const [id, row] of Object.entries(rows)) {
      const hasData = row.enabled || row.a?.src || row.b?.src || row.a?.label || row.b?.label;
      if (hasData) cfg.actors[id] = normalizeRow(row);
      else delete cfg.actors[id];
    }
    await setConfig(cfg);
    ui.notifications?.info(t("ATF.notify.saved"));
    this.render();
  }

  // --- per-row actions -------------------------------------------------------

  static async #onPickImage(_event, target) {
    const { actorId, slot } = target.dataset;
    const input = this.element.querySelector(`[name="actors.${actorId}.${slot}.src"]`);
    const preview = this.element.querySelector(`[data-preview="${actorId}.${slot}"]`);
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    new FilePicker({
      type: "image",
      current: input?.value || "",
      callback: (path) => {
        if (input) input.value = path;
        if (preview) preview.src = path;
      },
    }).render(true);
  }

  static async #onUseCurrent(_event, target) {
    const { actorId } = target.dataset;
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const src = actor.prototypeToken?.texture?.src ?? actor.img ?? "";
    const input = this.element.querySelector(`[name="actors.${actorId}.a.src"]`);
    const preview = this.element.querySelector(`[data-preview="${actorId}.a"]`);
    if (input) input.value = src;
    if (preview) preview.src = src;
  }

  static async #onApplySlot(_event, target) {
    const { actorId, slot } = target.dataset;
    const actor = game.actors.get(actorId);
    if (!actor) return;

    const row = normalizeRow(this.#readRow(actorId));
    if (!row[slot]?.src) {
      ui.notifications?.warn(t("ATF.errors.noImage"));
      return;
    }
    try {
      await setActorConfig(actorId, row); // persist so state is consistent
      await synchronizeAppearance(actor, row, slot);
      ui.notifications?.info(t("ATF.notify.applied", { label: row[slot].label || slot }));
    } catch (err) {
      error(err);
      ui.notifications?.error(t("ATF.errors.syncFailed"));
    }
  }

  static async #onRemoveActor(_event, target) {
    const { actorId } = target.dataset;
    await removeActorConfig(actorId);
    ui.notifications?.info(t("ATF.notify.removed"));
    this.render();
  }
}

function normalizeRow(row) {
  return {
    enabled: !!row.enabled,
    artMode: row.artMode === ART_MODES.RING ? ART_MODES.RING : ART_MODES.STANDARD,
    a: { label: (row.a?.label ?? "").trim(), src: (row.a?.src ?? "").trim() },
    b: { label: (row.b?.label ?? "").trim(), src: (row.b?.src ?? "").trim() },
  };
}
