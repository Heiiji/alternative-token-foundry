import { describe, expect, it } from "vitest";
import { INTERNAL_OPTION } from "../scripts/constants.mjs";
import {
  DEFAULT_TRANSITION,
  TOKEN_TRANSITIONS,
  appearanceUpdateOptions,
  getConfiguredTransition,
  isTokenTransition,
  resolveTransition,
  transitionSettingChoices,
} from "../scripts/animation.mjs";

describe("TOKEN_TRANSITIONS", () => {
  it("is the Foundry V13/V14 TokenAnimationTransition set, fade first", () => {
    expect(TOKEN_TRANSITIONS[0]).toBe("fade");
    expect([...TOKEN_TRANSITIONS].sort()).toEqual(
      [
        "crosshatch",
        "dots",
        "fade",
        "glitch",
        "hole",
        "holeSwirl",
        "hologram",
        "morph",
        "swirl",
        "waterDrop",
        "waves",
        "whiteNoise",
        "wind",
      ].sort(),
    );
    expect(new Set(TOKEN_TRANSITIONS).size).toBe(TOKEN_TRANSITIONS.length);
  });
});

describe("resolveTransition", () => {
  it("returns fade as the default", () => {
    expect(DEFAULT_TRANSITION).toBe("fade");
    expect(resolveTransition(undefined)).toBe("fade");
    expect(resolveTransition(null)).toBe("fade");
    expect(resolveTransition("")).toBe("fade");
  });

  it("accepts every documented Foundry transition", () => {
    for (const key of TOKEN_TRANSITIONS) {
      expect(isTokenTransition(key)).toBe(true);
      expect(resolveTransition(key)).toBe(key);
    }
  });

  it("rejects unknown or non-string values (forged / corrupt settings)", () => {
    expect(resolveTransition("dissolve")).toBe("fade");
    expect(resolveTransition("FADE")).toBe("fade");
    expect(resolveTransition({ transition: "swirl" })).toBe("fade");
  });
});

describe("transitionSettingChoices", () => {
  it("maps each transition to its i18n key, fade first", () => {
    const choices = transitionSettingChoices();
    expect(Object.keys(choices)[0]).toBe("fade");
    expect(Object.keys(choices)).toEqual([...TOKEN_TRANSITIONS]);
    expect(choices.swirl).toBe("ATF.transition.swirl");
  });
});

describe("appearanceUpdateOptions", () => {
  it("tags internal writes and applies the configured transition (fade without Foundry)", () => {
    expect(getConfiguredTransition()).toBe("fade");
    expect(appearanceUpdateOptions()).toEqual({
      [INTERNAL_OPTION]: true,
      animation: { transition: "fade" },
    });
  });

  it("reads the world setting key and uses its value when Foundry is present", () => {
    globalThis.game = {
      settings: {
        get(namespace, key) {
          expect(namespace).toBe("alternative-token-foundry");
          expect(key).toBe("appearanceTransition");
          return "swirl";
        },
      },
    };
    try {
      expect(getConfiguredTransition()).toBe("swirl");
      expect(appearanceUpdateOptions()).toEqual({
        [INTERNAL_OPTION]: true,
        animation: { transition: "swirl" },
      });
    } finally {
      delete globalThis.game;
    }
  });

  it("disables animation for rollback / reconcile without sending a transition", () => {
    expect(appearanceUpdateOptions({ animate: false })).toEqual({
      [INTERNAL_OPTION]: true,
      animate: false,
    });
  });
});

describe("localization", () => {
  it("has EN and FR labels for every transition and the setting itself", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const en = JSON.parse(readFileSync(join(root, "lang/en.json"), "utf8"));
    const fr = JSON.parse(readFileSync(join(root, "lang/fr.json"), "utf8"));
    for (const key of ["ATF.settings.transitionName", "ATF.settings.transitionHint", ...TOKEN_TRANSITIONS.map((k) => `ATF.transition.${k}`)]) {
      expect(en).toHaveProperty(key);
      expect(fr).toHaveProperty(key);
      expect(en[key].length).toBeGreaterThan(0);
      expect(fr[key].length).toBeGreaterThan(0);
    }
  });
});
