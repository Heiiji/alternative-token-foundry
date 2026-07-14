import { describe, expect, it } from "vitest";
import { activeField, otherSlot, resolveActiveSlot } from "../scripts/slots.mjs";

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
