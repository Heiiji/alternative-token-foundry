import { describe, expect, it } from "vitest";
import { buildPrototypeUpdate, buildTokenUpdate, planRollback, planSceneUpdates } from "../scripts/sync-plan.mjs";

describe("buildTokenUpdate", () => {
  it("targets texture.src for standard mode", () => {
    expect(buildTokenUpdate("t1", "standard", "a.webp")).toEqual({ _id: "t1", "texture.src": "a.webp" });
  });
  it("targets ring.subject.texture for ring mode", () => {
    expect(buildTokenUpdate("t1", "ring-subject", "a.webp")).toEqual({
      _id: "t1",
      "ring.subject.texture": "a.webp",
    });
  });
});

describe("buildPrototypeUpdate", () => {
  it("prefixes the field with prototypeToken", () => {
    expect(buildPrototypeUpdate("standard", "a.webp")).toEqual({ "prototypeToken.texture.src": "a.webp" });
    expect(buildPrototypeUpdate("ring-subject", "a.webp")).toEqual({
      "prototypeToken.ring.subject.texture": "a.webp",
    });
  });
});

describe("planSceneUpdates", () => {
  it("groups token updates by scene", () => {
    const tokens = [
      { id: "t1", sceneId: "s1" },
      { id: "t2", sceneId: "s1" },
      { id: "t3", sceneId: "s2" },
    ];
    const plan = planSceneUpdates(tokens, "standard", "new.webp");
    expect(plan.get("s1")).toHaveLength(2);
    expect(plan.get("s2")).toEqual([{ _id: "t3", "texture.src": "new.webp" }]);
  });

  it("skips tokens without a scene", () => {
    const plan = planSceneUpdates([{ id: "t1", sceneId: null }], "standard", "x");
    expect(plan.size).toBe(0);
  });
});

describe("planRollback", () => {
  it("restores each token's snapshotted src", () => {
    const snapshot = [
      { id: "t1", sceneId: "s1", src: "old1.webp" },
      { id: "t2", sceneId: "s2", src: "old2.webp" },
    ];
    const plan = planRollback(snapshot, "standard");
    expect(plan.get("s1")).toEqual([{ _id: "t1", "texture.src": "old1.webp" }]);
    expect(plan.get("s2")).toEqual([{ _id: "t2", "texture.src": "old2.webp" }]);
  });
});
