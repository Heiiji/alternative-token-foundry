import { describe, expect, it } from "vitest";
import { enqueue } from "../scripts/request-service.mjs";
import { withErrorDetail } from "../scripts/constants.mjs";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("enqueue", () => {
  it("runs tasks for the same actor strictly in order", async () => {
    const order = [];
    const slow = enqueue("actor-1", async () => {
      await tick();
      order.push("first");
    });
    const fast = enqueue("actor-1", async () => {
      order.push("second");
    });
    await Promise.all([slow, fast]);
    expect(order).toEqual(["first", "second"]);
  });

  it("keeps different actors independent", async () => {
    const order = [];
    let release;
    const gate = new Promise((r) => (release = r));
    const blocked = enqueue("actor-a", async () => {
      await gate;
      order.push("a");
    });
    await enqueue("actor-b", async () => {
      order.push("b");
    });
    expect(order).toEqual(["b"]);
    release();
    await blocked;
    expect(order).toEqual(["b", "a"]);
  });

  it("rejects the caller on failure but keeps the queue usable", async () => {
    await expect(enqueue("actor-2", () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(enqueue("actor-2", async () => "ok")).resolves.toBe("ok");
  });

  it("does not leave an unhandled rejection behind a failed task", async () => {
    const unhandled = [];
    const onUnhandled = (err) => unhandled.push(err);
    process.on("unhandledRejection", onUnhandled);
    try {
      await enqueue("actor-3", () => Promise.reject(new Error("boom"))).catch(() => {});
      // Unhandled rejections surface on later macrotasks; give them a chance.
      await tick();
      await tick();
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});

describe("withErrorDetail", () => {
  it("appends the error message", () => {
    expect(withErrorDetail("Failed.", new Error("Token x does not exist"))).toBe(
      "Failed. [Token x does not exist]",
    );
  });

  it("accepts non-Error values and collapses whitespace", () => {
    expect(withErrorDetail("Failed.", "a\n  b")).toBe("Failed. [a b]");
  });

  it("returns the base message when there is no detail", () => {
    expect(withErrorDetail("Failed.", undefined)).toBe("Failed.");
    expect(withErrorDetail("Failed.", new Error(""))).toBe("Failed.");
  });

  it("truncates very long messages", () => {
    const long = "x".repeat(500);
    expect(withErrorDetail("Failed.", new Error(long)).length).toBeLessThanOrEqual("Failed. []".length + 200);
  });
});
