import { describe, expect, it } from "vitest";
import { activeField, currentArtSrc, inferArtMode, otherSlot, resolveActiveSlot } from "../scripts/slots.mjs";

const config = {
  a: { label: "Normal", src: "tokens/normal.webp" },
  b: { label: "Armored", src: "tokens/armored.webp" },
};

describe("activeField", () => {
  it("maps art mode to the correct document field", () => {
    expect(activeField("standard")).toBe("texture.src");
    expect(activeField("ring-subject")).toBe("ring.subject.texture");
    expect(activeField(undefined)).toBe("texture.src");
  });
});

describe("otherSlot", () => {
  it("returns the opposite slot", () => {
    expect(otherSlot("a")).toBe("b");
    expect(otherSlot("b")).toBe("a");
  });
});

describe("resolveActiveSlot", () => {
  it("resolves slot a and b, ignoring cache-busting query strings", () => {
    expect(resolveActiveSlot("tokens/normal.webp", config)).toBe("a");
    expect(resolveActiveSlot("tokens/armored.webp?v=9", config)).toBe("b");
  });

  it("returns null when the image matches neither slot (out of sync)", () => {
    expect(resolveActiveSlot("tokens/other.webp", config)).toBeNull();
    expect(resolveActiveSlot("", config)).toBeNull();
    expect(resolveActiveSlot("tokens/normal.webp", null)).toBeNull();
  });
});

describe("inferArtMode", () => {
  it("keeps an explicit saved mode", () => {
    expect(inferArtMode({ ring: { enabled: true } }, "standard")).toBe("standard");
    expect(inferArtMode({ ring: { enabled: false } }, "ring-subject")).toBe("ring-subject");
  });

  it("infers ring-subject from ring.enabled when nothing is saved", () => {
    expect(inferArtMode({ ring: { enabled: true } })).toBe("ring-subject");
    expect(inferArtMode({ ring: { enabled: false } })).toBe("standard");
    expect(inferArtMode({})).toBe("standard");
  });
});

describe("currentArtSrc", () => {
  it("reads texture.src for standard mode and the ring subject otherwise", () => {
    const proto = {
      texture: { src: "tokens/plain.webp" },
      ring: { enabled: true, subject: { texture: "tokens/subject.webp" } },
    };
    expect(currentArtSrc(proto, "standard")).toBe("tokens/plain.webp");
    expect(currentArtSrc(proto, "ring-subject")).toBe("tokens/subject.webp");
    expect(currentArtSrc(null, "standard")).toBe("");
  });
});
