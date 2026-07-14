import { describe, expect, it } from "vitest";
import { normalizePath, samePath } from "../scripts/paths.mjs";

describe("normalizePath", () => {
  it("returns empty string for non-strings / falsy", () => {
    expect(normalizePath(undefined)).toBe("");
    expect(normalizePath(null)).toBe("");
    expect(normalizePath(42)).toBe("");
    expect(normalizePath("")).toBe("");
  });

  it("strips query strings and hash fragments", () => {
    expect(normalizePath("tokens/a.webp?12345")).toBe("tokens/a.webp");
    expect(normalizePath("tokens/a.webp#frag")).toBe("tokens/a.webp");
  });

  it("decodes percent-encoding", () => {
    expect(normalizePath("worlds/my%20world/a.webp")).toBe("worlds/my world/a.webp");
  });

  it("normalizes backslashes and trailing slashes", () => {
    expect(normalizePath("worlds\\x\\a.webp")).toBe("worlds/x/a.webp");
    expect(normalizePath("tokens/dir/")).toBe("tokens/dir");
  });
});

describe("samePath", () => {
  it("treats differently-encoded references to one file as equal", () => {
    expect(samePath("worlds/x/a.webp?v=2", "worlds/x/a.webp")).toBe(true);
    expect(samePath("worlds/my%20world/a.webp", "worlds/my world/a.webp")).toBe(true);
  });

  it("is false for different files and for empty inputs", () => {
    expect(samePath("a.webp", "b.webp")).toBe(false);
    expect(samePath("", "")).toBe(false);
    expect(samePath(undefined, "a.webp")).toBe(false);
  });
});
