# Alternative Token Foundry — Design Spec

**Date:** 2026-07-14
**Status:** Approved
**Target:** Foundry VTT V14 (runs on V13+, verified on V14)

A small, system-agnostic Foundry VTT module that lets **players** switch their character
token between **two GM-approved appearances** (e.g. *Normal* / *Armored*) with one click,
while the GM keeps full control over which images are allowed.

---

## 1. Goal & scope

Players own a character with a linked token. The GM configures exactly two approved token
images per character. A one-click button in the Token HUD lets the owner toggle between the
two forms. The appearance belongs to the **character**, so every linked token (across all
scenes) and the Actor's **prototype token** update together and the choice survives reloads.

### In scope
- Exactly two images + labels per configured Actor.
- GM-only configuration screen.
- One-click toggle in the Token HUD for owners (and GM).
- Standard token images **and** Dynamic Token Ring subjects (per-actor art mode).
- Sync of all linked tokens across scenes + prototype token.
- Robust player→GM authority (works regardless of world permission settings).
- Multiple simultaneous GMs handled safely.
- Best-effort rollback on partial failure.
- EN + FR localization.
- Installable release (manifest + download URL, CI-built zip).

### Explicitly out of scope (MVP)
More than two forms; per-scene differences; unlinked-token state; animated transitions;
portrait switching; automation from conditions/HP/items; character-sheet integration;
keyboard shortcuts; compendium-actor configuration.

---

## 2. Security model — the core split

The "no arbitrary image paths" guarantee comes from **where each piece of data lives**:

| Store | Location | Who can write | Contents |
|---|---|---|---|
| **Config** | World setting `actorConfigurations` (`config:false`) | **GM only** | per actor: `enabled`, `artMode`, `a{label,src}`, `b{label,src}` |
| **Request** | Actor flag `flags.<id>.request` | Actor owner (player) | `{id, target:"a"|"b", requestedAt}` — **never a path** |
| **Result** | Actor flag `flags.<id>.lastResult` | GM (authoritative) | `{requestId, success, message?, completedAt}` — feedback only |

A player owns their Actor, so they *can* write the request flag — but the only thing it can
carry is a slot letter (`"a"`/`"b"`). The GM resolves that letter to an actual image from
GM-only config. Even a hand-edited flag cannot inject a file path.

The request flows through the Actor document (not a raw socket) so the GM receives the
**server-supplied `userId`** of the initiator via the `updateActor` hook — trusted identity
with no dependency and no custom sender verification.

---

## 3. Data model

```jsonc
// World setting: actorConfigurations
{
  "schemaVersion": 1,
  "actors": {
    "<actorId>": {
      "enabled": true,
      "artMode": "standard",            // "standard" | "ring-subject"
      "a": { "label": "Normal",  "src": "worlds/x/tokens/cerbere-normal.webp" },
      "b": { "label": "Armored", "src": "worlds/x/tokens/cerbere-armored.webp" }
    }
  }
}
```

```jsonc
// Actor flag: request                      // Actor flag: lastResult
{ "id": "uuid", "target": "b",              { "requestId": "uuid", "success": true,
  "requestedAt": 1731600000000 }              "message": "...", "completedAt": 1731600001000 }
```

---

## 4. Source of truth — art-mode-aware

There is **no separate `active` field**. The prototype token's image *is* the persistent
source of truth. The field read depends on the actor's art mode:

```
activeField(artMode) = artMode === "ring-subject" ? "ring.subject.texture" : "texture.src"
```

`resolveActiveSlot` compares the prototype's current value against slot A/B using
**normalized paths** (decode URI, strip query string/hash, trim slashes) — raw `===` is
fragile because Foundry can rewrite paths. If it matches neither slot, the actor is
**out-of-sync** (handled gracefully, never crashes).

---

## 5. Switch flow

**Player path**
1. Owner clicks the HUD button → writes the `request` flag to the owned Actor.
2. Foundry fires `updateActor` on all clients with a server-verified `userId`.
3. The **elected primary GM** validates: user owns actor? config enabled? target ∈ {a,b}?
   not stale (<15s)? image present?
4. GM looks up the approved image and runs the sync (§6), tagging its own updates so the
   module's hooks skip them.
5. GM writes `lastResult`, clears `request`. The requesting client shows a toast.

**GM path (fast-path)**
A GM clicking the button is already authoritative → applies the sync directly, no relay,
no round-trip.

---

## 6. Synchronization

```
tokens = actor.getDependentTokens({ linked: true })        // all scenes
snapshot every token's active field + prototype's active field
try:
  for each scene: scene.updateEmbeddedDocuments("Token", updates, { atfInternal:true })
  actor.update({ "prototypeToken.<field>": src }, { atfInternal:true })
catch:
  restore from snapshots (best-effort rollback)
```

Only the image field changes — scale, dimensions, vision, tint, bars, disposition, ring
colors, and all system data are untouched. The Actor **portrait** is never changed.

`createToken` reconciles: a freshly dropped linked token whose art doesn't match the active
slot is brought into line.

---

## 7. Authority & concurrency

- **Election:** among `game.users` that are `active && isGM`, the lowest `id` wins
  (deterministic across clients). On `ready`/`userConnected`, the newly elected GM recovers
  any non-expired pending request (survives GM handover).
- **Per-actor queue:** a promise chain per actor serializes rapid/concurrent clicks so two
  owners of the same actor never produce overlapping updates.
- **Anti-loop:** all module-originated document updates carry `{ atfInternal:true }` in
  options; the module's own update hooks ignore tagged updates.
- **Stale requests** (>15s) are rejected.

---

## 8. UX

**Player button** — instant toggle (never a dialog, since there are exactly two forms).
Tooltip reads the *target* label ("Switch to Armored"). States: ready / spinner (processing)
/ disabled (no GM online) / warning (out-of-sync) / hidden (ineligible). A `DialogV2` appears
**only** when out-of-sync ("current art matches neither form — pick one").

**Eligibility** (button shown only if all true): token is linked; requester owns the actor;
config exists and is `enabled`; both images present.

**GM config screen** (`ApplicationV2` + `HandlebarsApplicationMixin`, GM-restricted via
`registerMenu({restricted:true})`): lists player-owned world actors; per actor — enable
toggle, two image slots with File Picker (`foundry.applications.apps.FilePicker.implementation`)
+ live preview, editable labels, art-mode dropdown, and shortcuts (*Use current prototype as
A*, *Apply A/B now*, *Remove*). Save is blocked until both images are set, differ, and both
labels are non-empty.

---

## 9. V14 API notes (verified)

- `renderTokenHUD(hud, element, ...)` — `element` is a **native `HTMLElement`** (no jQuery);
  inject `div.control-icon` into `.col.left`/`.col.right`.
- Config screen: `foundry.applications.api.HandlebarsApplicationMixin(ApplicationV2)`
  (`FormApplication` deprecated).
- File Picker: `foundry.applications.apps.FilePicker.implementation` (bare global removed).
- `Actor#getDependentTokens({ linked, scenes })` → `TokenDocument[]`.
- `updateActor(document, changed, options, userId)` — flag diffs appear in `changed`;
  custom `options` keys delivered to hooks; `userId` server-supplied.
- Field paths: `prototypeToken.texture.src`, `prototypeToken.ring.subject.texture`;
  on placed token `ring.subject.texture`, `ring.enabled`.
- `DialogV2`, `testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)`,
  `setFlag`/`getFlag`(sync)/`unsetFlag`, `game.modules.get(id).api` — all confirmed.

---

## 10. Repo layout

```
alternative-token-foundry/
├── module.json                    # compatibility {minimum:"13", verified:"14"}
├── scripts/
│   ├── main.mjs                   # hook wiring
│   ├── constants.mjs              # ids, keys, t() helper
│   ├── paths.mjs        (pure)    # normalizePath
│   ├── slots.mjs        (pure)    # activeField, resolveActiveSlot, otherSlot
│   ├── authority.mjs    (pure)    # electPrimaryGM
│   ├── validation.mjs   (pure)    # validateActorConfig, validateSwitchRequest
│   ├── sync-plan.mjs    (pure)    # buildTokenUpdate/PrototypeUpdate, planSceneUpdates, planRollback
│   ├── settings.mjs               # register setting + GM menu
│   ├── config-repository.mjs      # read/write config, per-actor lookup
│   ├── config-app.mjs             # ApplicationV2 config screen
│   ├── hud-controller.mjs         # renderTokenHUD handler + button states
│   ├── request-service.mjs        # player request + GM processing + per-actor queue
│   └── sync-service.mjs           # synchronizeAppearance + rollback
├── templates/config.hbs
├── styles/alternative-token-foundry.css
├── lang/en.json, lang/fr.json
├── tests/*.test.mjs               # vitest on pure logic
├── .github/workflows/release.yml  # tag vX.Y.Z → build zip → GitHub Release
├── README.md, LICENSE, .gitignore, .editorconfig, package.json
```

Pure modules never touch Foundry globals at import time, so they are unit-testable under
vitest with plain objects. Foundry-integrated modules get a manual QA checklist (§12).

---

## 11. Release / distribution

- `module.json` `manifest` → stable `.../releases/latest/download/module.json`;
  `download` → versioned `.../releases/download/v<version>/module.zip`.
- CI (`release.yml`) triggers on pushing a `v*` tag: it stamps `version` + `download` from
  the tag into `module.json`, zips the module, and publishes a GitHub Release with
  `module.json` + `module.zip` attached. `permissions: contents: write`.
- Install/update in Foundry via the stable manifest URL.

---

## 12. Acceptance criteria (QA checklist)

1. GM can configure two images + labels for a world actor.
2. Config survives server and browser reload.
3. Only owners of the configured actor see the button.
4. Button appears only on linked tokens.
5. One click changes the token to the other image.
6. All linked tokens for the actor change across scenes.
7. Prototype token changes too.
8. A newly placed token uses the active appearance.
9. The Actor-sheet portrait is unchanged.
10. A non-owner cannot trigger a switch.
11. A forged image path cannot pass through the request.
12. Multiple connected GMs do not duplicate the operation.
13. Failed updates restore the previous artwork.
14. Rapid clicks never leave tokens inconsistent.
15. Standard tokens keep scale, dimensions, tint, vision, bars.
16. EN + FR labels display correctly.
17. Disabling an actor removes the button without altering current art.

Pure-logic units (1,4,5,6,7,10,11,12,13,14 decision paths, 17) are covered by vitest;
the rest are manual QA in a live world.

---

## 13. Amendment (v0.0.2): unlinked token support

Live testing (Knight system) surfaced that player tokens are frequently **unlinked**, and the
v0.0.1 MVP hid the button on those tokens (acceptance criterion #4). The synthetic actor of an
unlinked token keeps the base actor id, so config resolution already works — only the switch
semantics needed defining. Changed behavior:

- **Eligibility:** the button now shows on unlinked tokens too (owner + enabled config + both
  images still required). Criterion #4 is superseded.
- **Switch semantics by link state:**
  - *Linked* token → character-level (all linked tokens + prototype), unchanged.
  - *Unlinked* token → **that token only** (`switchSingleToken`), because each unlinked token
    is independent. The prototype and sibling tokens are left untouched.
- **Active slot source of truth:** linked tokens resolve from the prototype; unlinked tokens
  resolve from the clicked token's own current image.
- **Request channel:** the request now carries `tokenUuid`; the flag is always written to the
  **base world actor** (a synthetic token actor's flags would not fire `updateActor` on the
  GM). The GM resolves the token via uuid and picks the per-token or character-level path.
- **Security unchanged:** still path-free (`"a"`/`"b"` + uuid), still validated for ownership
  of the base actor on the authoritative GM.
