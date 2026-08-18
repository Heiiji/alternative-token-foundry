import { describe, expect, it } from "vitest";
import {
  atfNameSuffix,
  buildTokenizerLaunchOptions,
  parseTokenizerResponse,
  shouldSyncAfterTokenize,
  tokenBasenameHasAtfSuffix,
  tokenizerActorType,
  tokenizerResultIsNoop,
} from "../scripts/tokenizer-bridge.mjs";

describe("atfNameSuffix", () => {
  it("is unique per actor and slot", () => {
    expect(atfNameSuffix("abc", "a")).toBe(".atf.abc.a");
    expect(atfNameSuffix("abc", "b")).toBe(".atf.abc.b");
    expect(atfNameSuffix("xyz", "a")).toBe(".atf.xyz.a");
    expect(atfNameSuffix("abc", "a")).not.toBe(atfNameSuffix("abc", "b"));
    expect(atfNameSuffix("abc", "a")).not.toBe(atfNameSuffix("xyz", "a"));
  });
});

describe("tokenizerActorType", () => {
  it("maps character/pc to pc and everything else to npc", () => {
    expect(tokenizerActorType("character")).toBe("pc");
    expect(tokenizerActorType("pc")).toBe("pc");
    expect(tokenizerActorType("npc")).toBe("npc");
    expect(tokenizerActorType("loot")).toBe("npc");
  });
});

describe("tokenBasenameHasAtfSuffix", () => {
  it("detects the suffix in Tokenizer's output filename", () => {
    expect(tokenBasenameHasAtfSuffix("uploads/cerbere.Token.atf.abc.a.webp", "abc", "a")).toBe(true);
    expect(tokenBasenameHasAtfSuffix("uploads/cerbere.Token.atf.abc.b.webp", "abc", "a")).toBe(false);
    expect(tokenBasenameHasAtfSuffix("uploads/cerbere.Token.webp", "abc", "a")).toBe(false);
  });
});

describe("tokenizerResultIsNoop", () => {
  it("is a no-op when Modify Token left the seed path unchanged", () => {
    expect(tokenizerResultIsNoop("tokens/normal.webp", "tokens/normal.webp", "abc", "a")).toBe(true);
  });

  it("is not a no-op when the ATF suffix is present (re-tokenize same slot)", () => {
    const file = "uploads/cerbere.Token.atf.abc.a.webp";
    expect(tokenizerResultIsNoop(file, file, "abc", "a")).toBe(false);
  });

  it("is not a no-op when the path changed to a new file", () => {
    expect(tokenizerResultIsNoop("uploads/new.webp", "tokens/normal.webp", "abc", "a")).toBe(false);
  });

  it("is a no-op for missing filenames", () => {
    expect(tokenizerResultIsNoop("", "tokens/a.webp", "abc", "a")).toBe(true);
    expect(tokenizerResultIsNoop(undefined, "tokens/a.webp", "abc", "a")).toBe(true);
  });
});

describe("shouldSyncAfterTokenize", () => {
  it("syncs only when the tokenized slot is already showing", () => {
    expect(shouldSyncAfterTokenize("a", "a", false)).toBe(true);
    expect(shouldSyncAfterTokenize("b", "a", false)).toBe(false);
    expect(shouldSyncAfterTokenize("a", "b", false)).toBe(false);
  });

  it("never syncs when out of sync", () => {
    expect(shouldSyncAfterTokenize(null, "a", true)).toBe(false);
    expect(shouldSyncAfterTokenize("a", "a", true)).toBe(false);
  });
});

describe("buildTokenizerLaunchOptions", () => {
  it("omits actor and token, and stamps the slot suffix plus pass-through ids", () => {
    const opts = buildTokenizerLaunchOptions({
      name: "Cerbere",
      type: "pc",
      disposition: 1,
      tokenFilename: "tokens/normal.webp",
      avatarFilename: "portraits/cerbere.webp",
      actorId: "abc",
      slot: "a",
      otherSlotSrc: "tokens/armored.webp",
    });
    expect(opts.actor).toBeUndefined();
    expect(opts.token).toBeUndefined();
    expect(opts.forceDynamicRing).toBeUndefined();
    expect(opts.isWildCard).toBe(false);
    expect(opts.nameSuffix).toBe(".atf.abc.a");
    expect(opts.atfActorId).toBe("abc");
    expect(opts.atfSlot).toBe("a");
    expect(opts.atfSeedTokenFilename).toBe("tokens/normal.webp");
    expect(opts.atfOtherSlotSrc).toBe("tokens/armored.webp");
  });
});

describe("parseTokenizerResponse", () => {
  const base = {
    atfActorId: "abc",
    atfSlot: "a",
    atfSeedTokenFilename: "tokens/normal.webp",
    atfOtherSlotSrc: "tokens/armored.webp",
    tokenFilename: "uploads/cerbere.Token.atf.abc.a.webp",
    avatarFilename: "uploads/cerbere.Avatar.atf.abc.a.webp",
  };

  it("persists the cleaned token path and ignores the avatar", () => {
    const parsed = parseTokenizerResponse({ ...base, tokenFilename: "uploads/cerbere.Token.atf.abc.a.webp?99" });
    expect(parsed).toEqual({ ok: true, src: "uploads/cerbere.Token.atf.abc.a.webp", actorId: "abc", slot: "a" });
  });

  it("rejects a no-op Apply", () => {
    expect(parseTokenizerResponse({ ...base, tokenFilename: "tokens/normal.webp" })).toEqual({
      ok: false,
      reason: "ATF.notify.tokenizerNoop",
    });
  });

  it("rejects a file that collides with the other slot", () => {
    expect(
      parseTokenizerResponse({
        ...base,
        tokenFilename: "tokens/armored.webp?3",
        atfOtherSlotSrc: "tokens/armored.webp",
      }),
    ).toEqual({ ok: false, reason: "ATF.errors.imagesMustDiffer" });
  });

  it("rejects a missing or invalid payload", () => {
    expect(parseTokenizerResponse(null).ok).toBe(false);
    expect(parseTokenizerResponse({ ...base, atfSlot: "c" }).ok).toBe(false);
  });
});
