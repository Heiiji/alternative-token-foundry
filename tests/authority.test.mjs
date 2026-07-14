import { describe, expect, it } from "vitest";
import { electPrimaryGM } from "../scripts/authority.mjs";

describe("electPrimaryGM", () => {
  it("returns null when no GM is active", () => {
    expect(electPrimaryGM([])).toBeNull();
    expect(electPrimaryGM([{ id: "u1", active: true, isGM: false }])).toBeNull();
    expect(electPrimaryGM([{ id: "g1", active: false, isGM: true }])).toBeNull();
    expect(electPrimaryGM(undefined)).toBeNull();
  });

  it("elects the lowest id among active GMs (deterministic)", () => {
    const users = [
      { id: "gm-z", active: true, isGM: true },
      { id: "gm-a", active: true, isGM: true },
      { id: "player", active: true, isGM: false },
      { id: "gm-m", active: false, isGM: true },
    ];
    expect(electPrimaryGM(users)).toBe("gm-a");
  });

  it("is stable regardless of input order", () => {
    const a = [
      { id: "2", active: true, isGM: true },
      { id: "1", active: true, isGM: true },
    ];
    const b = [
      { id: "1", active: true, isGM: true },
      { id: "2", active: true, isGM: true },
    ];
    expect(electPrimaryGM(a)).toBe(electPrimaryGM(b));
    expect(electPrimaryGM(a)).toBe("1");
  });
});
