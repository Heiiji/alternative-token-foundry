/**
 * GM configuration screen: pick two approved images + labels per player-owned
 * actor, choose art mode, enable/disable, and apply an appearance immediately.
 *
 * Built on ApplicationV2 + HandlebarsApplicationMixin (V14; FormApplication is
 * deprecated). Registered GM-only via settings.registerMenu({ restricted:true }).
 */

import { ART_MODES, MODULE_ID, t, error, withErrorDetail } from "./constants.mjs";
import { getActorConfig, getConfig, removeActorConfig, setActorConfig, setConfig } from "./config-repository.mjs";
import { validateActorConfig } from "./validation.mjs";
import { cacheBustPath, normalizePath, samePath } from "./paths.mjs";
import { currentArtSrc, inferArtMode, resolveActiveSlot } from "./slots.mjs";
import { synchronizeAppearance } from "./sync-service.mjs";
import { enqueue } from "./request-service.mjs";
import { isTokenizerAvailable, launchSlotTokenizer, shouldSyncAfterTokenize } from "./tokenizer-bridge.mjs";

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
function defaultActorConfig(actor, { enabledByDefault = false } = {}) {
  const artMode = inferArtMode(actor.prototypeToken);
  const src = normalizePath(currentArtSrc(actor.prototypeToken, artMode) || actor.img || "");
  return {
    enabled: enabledByDefault,
    artMode,
    a: { label: t("ATF.config.defaultLabelA"), src },
    b: { label: t("ATF.config.defaultLabelB"), src: "" },
  };
}

/** Build the template context for a single actor's card. */
function buildActorCard(actor, cfg, artModes, { enabledByDefault = false } = {}) {
  const stored = cfg.actors?.[actor.id];
  const ac = stored ?? defaultActorConfig(actor, { enabledByDefault });
  const artMode = inferArtMode(actor.prototypeToken, ac.artMode);
  return {
    id: actor.id,
    name: actor.name,
    img: actor.img,
    enabled: !!ac.enabled,
    artMode,
    a: { label: ac.a?.label ?? "", src: ac.a?.src ?? "" },
    b: { label: ac.b?.label ?? "", src: ac.b?.src ?? "" },
    artModes: artModes.map((m) => ({ ...m, selected: m.value === artMode })),
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
      tokenizeSlot: AtfConfigApp.#onTokenizeSlot,
      removeActor: AtfConfigApp.#onRemoveActor,
    },
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/config.hbs`, scrollable: [".atf-actors"] },
  };

  /**
   * Open the config scoped to a single actor (from the Token HUD edit button).
   * Bypasses the player-owned filter so the GM can configure any actor. Reuses an
   * already-open window for the same actor instead of stacking duplicates.
   * @param {string} actorId
   */
  static openForActor(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return null;
    const id = `atf-config-${actorId}`;
    const existing = foundry.applications.instances?.get(id);
    if (existing) return existing.render({ force: true });
    const app = new AtfConfigApp({
      id,
      scopedActorId: actorId,
      window: { title: game.i18n.format("ATF.config.scopedTitle", { name: actor.name }) },
    });
    return app.render({ force: true });
  }

  async _prepareContext() {
    const cfg = getConfig();
    const artModes = [
      { value: ART_MODES.STANDARD, label: t("ATF.artMode.standard") },
      { value: ART_MODES.RING, label: t("ATF.artMode.ring") },
    ];

    const scopedId = this.options.scopedActorId;
    let actors;
    if (scopedId) {
      const actor = game.actors.get(scopedId);
      actors = actor ? [buildActorCard(actor, cfg, artModes, { enabledByDefault: true })] : [];
    } else {
      actors = eligibleActors()
        .map((actor) => buildActorCard(actor, cfg, artModes))
        .sort((x, y) => x.name.localeCompare(y.name));
    }

    const tokenizerAvailable = isTokenizerAvailable();
    return {
      actors,
      hasActors: actors.length > 0,
      scoped: !!scopedId,
      tokenizerAvailable,
    };
  }

  // --- form fields -> config -------------------------------------------------

  /** Whether this window still has a live DOM to read form values from. */
  #hasLiveForm() {
    return !!this.element?.isConnected;
  }

  #readRow(actorId) {
    const root = this.element;
    const q = (suffix) => root?.querySelector(`[name="actors.${actorId}.${suffix}"]`);
    return {
      enabled: !!q("enabled")?.checked,
      artMode: q("artMode")?.value ?? ART_MODES.STANDARD,
      a: { label: q("a.label")?.value?.trim() ?? "", src: q("a.src")?.value?.trim() ?? "" },
      b: { label: q("b.label")?.value?.trim() ?? "", src: q("b.src")?.value?.trim() ?? "" },
    };
  }

  #writeSlotSrc(actorId, slot, src) {
    const input = this.element?.querySelector(`[name="actors.${actorId}.${slot}.src"]`);
    const preview = this.element?.querySelector(`[data-preview="${actorId}.${slot}"]`);
    if (input) input.value = src;
    if (preview) preview.src = src;
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
        const src = normalizePath(path);
        if (input) input.value = src;
        if (preview) preview.src = src;
      },
    }).render(true);
  }

  static async #onUseCurrent(_event, target) {
    const { actorId } = target.dataset;
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const artMode =
      this.element.querySelector(`[name="actors.${actorId}.artMode"]`)?.value ?? ART_MODES.STANDARD;
    const src = normalizePath(currentArtSrc(actor.prototypeToken, artMode) || actor.img || "");
    const input = this.element.querySelector(`[name="actors.${actorId}.a.src"]`);
    const preview = this.element.querySelector(`[data-preview="${actorId}.a"]`);
    if (input) input.value = src;
    if (preview) preview.src = src;
  }

  static async #onApplySlot(_event, target) {
    const { actorId, slot } = target.dataset;
    const actor = game.actors.get(actorId);
    if (!actor || target.disabled) return;

    const row = normalizeRow(this.#readRow(actorId));
    if (!row[slot]?.src) {
      ui.notifications?.warn(t("ATF.errors.noImage"));
      return;
    }
    target.disabled = true;
    try {
      // Same per-actor queue as HUD switches, so an apply can never interleave
      // with a concurrent switch (or a second click) for this actor.
      await enqueue(actorId, async () => {
        await setActorConfig(actorId, row); // persist so state is consistent
        await synchronizeAppearance(actor, row, slot);
      });
      ui.notifications?.info(t("ATF.notify.applied", { label: row[slot].label || slot }));
    } catch (err) {
      error(err);
      ui.notifications?.error(withErrorDetail(t("ATF.errors.syncFailed"), err));
    } finally {
      target.disabled = false;
    }
  }

  static async #onTokenizeSlot(_event, target) {
    const { actorId, slot } = target.dataset;
    const actor = game.actors.get(actorId);
    if (!actor) return;

    const row = this.#readRow(actorId);
    const other = slot === "a" ? "b" : "a";
    const seedSrc = row[slot]?.src || currentArtSrc(actor.prototypeToken, row.artMode) || "";
    launchSlotTokenizer({
      actor,
      slot,
      seedSrc,
      otherSlotSrc: row[other]?.src ?? "",
      onResult: (parsed) => this.#applyTokenizerResult(actorId, slot, parsed),
    });
  }

  async #applyTokenizerResult(actorId, slot, parsed) {
    if (!parsed?.ok) {
      ui.notifications?.warn(t(parsed?.reason ?? "ATF.notify.tokenizerNoop"));
      return;
    }

    const actor = game.actors.get(actorId);
    // The GM may have closed this window while Tokenizer stayed open. Fall back
    // to the stored configuration instead of reading a dead form.
    const liveForm = this.#hasLiveForm();
    const previousRow = normalizeRow(liveForm ? this.#readRow(actorId) : (getActorConfig(actorId) ?? {}));
    const liveSrc = actor ? currentArtSrc(actor.prototypeToken, previousRow.artMode) : "";
    const activeBefore = resolveActiveSlot(liveSrc, previousRow);
    const outOfSync = activeBefore == null;

    this.#writeSlotSrc(actorId, slot, parsed.src);
    const row = liveForm
      ? normalizeRow(this.#readRow(actorId))
      : normalizeRow({ ...previousRow, [slot]: { ...previousRow[slot], src: parsed.src } });
    if (samePath(row.a.src, row.b.src)) {
      this.#writeSlotSrc(actorId, slot, previousRow[slot]?.src ?? "");
      ui.notifications?.error(t("ATF.errors.imagesMustDiffer"));
      return;
    }

    try {
      await setActorConfig(actorId, row);
    } catch (err) {
      error(err);
      ui.notifications?.error(withErrorDetail(t("ATF.errors.syncFailed"), err));
      return;
    }

    if (shouldSyncAfterTokenize(activeBefore, slot, outOfSync) && actor) {
      const syncConfig = {
        ...row,
        [slot]: { ...row[slot], src: cacheBustPath(row[slot].src) },
      };
      try {
        await enqueue(actorId, () => synchronizeAppearance(actor, syncConfig, slot));
        ui.notifications?.info(t("ATF.notify.applied", { label: row[slot].label || slot }));
      } catch (err) {
        error(err);
        ui.notifications?.error(withErrorDetail(t("ATF.errors.syncFailed"), err));
      }
      return;
    }

    ui.notifications?.info(t("ATF.notify.tokenizerSavedHidden", { label: row[slot].label || slot }));
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
    a: { label: (row.a?.label ?? "").trim(), src: normalizePath(row.a?.src ?? "") },
    b: { label: (row.b?.label ?? "").trim(), src: normalizePath(row.b?.src ?? "") },
  };
}
