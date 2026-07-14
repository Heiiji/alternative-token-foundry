import { describe, expect, it } from "vitest";
import { validateActorConfig, validateSwitchRequest } from "../scripts/validation.mjs";

describe("validateActorConfig", () => {
  const valid = {
    a: { label: "Normal", src: "tokens/a.webp" },
    b: { label: "Armored", src: "tokens/b.webp" },
  };

  it("accepts a complete, distinct config", () => {
    expect(validateActorConfig(valid)).toEqual([]);
  });

  it("requires both images", () => {
    expect(validateActorConfig({ ...valid, a: { label: "x", src: "" } })).toContain("ATF.errors.imageARequired");
    expect(validateActorConfig({ ...valid, b: { label: "x", src: "" } })).toContain("ATF.errors.imageBRequired");
  });

  it("requires the two images to differ", () => {
    const cfg = { a: { label: "x", src: "same.webp" }, b: { label: "y", src: "same.webp" } };
    expect(validateActorConfig(cfg)).toContain("ATF.errors.imagesMustDiffer");
  });

  it("requires both labels", () => {
    expect(validateActorConfig({ ...valid, a: { label: "  ", src: "tokens/a.webp" } })).toContain(
      "ATF.errors.labelARequired",
    );
  });
});

describe("validateSwitchRequest", () => {
  const base = { enabled: true, ownsActor: true, target: "b", requestedAt: 1000, now: 1500, hasImage: true };

  it("accepts a well-formed request", () => {
    expect(validateSwitchRequest(base)).toEqual({ ok: true });
  });

  it("rejects a non-owner (security)", () => {
    expect(validateSwitchRequest({ ...base, ownsActor: false })).toEqual({
      ok: false,
      error: "ATF.errors.notOwner",
    });
  });

  it("rejects an invalid target slot (forged path attempt)", () => {
    expect(validateSwitchRequest({ ...base, target: "/etc/passwd" }).ok).toBe(false);
    expect(validateSwitchRequest({ ...base, target: "c" }).error).toBe("ATF.errors.invalidTarget");
  });

  it("rejects a disabled config", () => {
    expect(validateSwitchRequest({ ...base, enabled: false }).error).toBe("ATF.errors.notEnabled");
  });

  it("rejects a stale request", () => {
    expect(validateSwitchRequest({ ...base, requestedAt: 0, now: 999999 }).error).toBe("ATF.errors.expired");
  });

  it("rejects a target with no image", () => {
    expect(validateSwitchRequest({ ...base, hasImage: false }).error).toBe("ATF.errors.noImage");
  });
});
