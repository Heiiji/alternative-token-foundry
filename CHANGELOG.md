# Changelog

All notable changes to this project are documented here. The format is loosely based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.0.6] — 2026-08-18

### Fixed
- **HUD switch worked only once per HUD render.** The switch button captured the
  active/target slot when the HUD was drawn, and Foundry does not re-render an open Token
  HUD when token art changes — so the second click silently re-applied the slot already
  showing. The target slot is now recomputed from live document state at click time, the
  HUD re-renders after a switch (and on any token art update via a `updateToken` hook), and
  clicks are ignored while a switch is processing.
- **Apply / Tokenizer syncs could interleave with HUD switches.** The config screen's
  *Apply* and post-Tokenize syncs now run through the same per-actor queue as switch
  requests, and the *Apply* button is disabled while its sync is in flight.
- Tokenizer callback no longer reads a dead form when the config window was closed while
  Tokenizer stayed open; it falls back to the stored configuration.
- Stale (deleted) token documents are filtered out before batch updates, so one ghost token
  can no longer make the whole appearance sync fail and roll back.
- Failed queue tasks no longer fire unhandled-rejection console noise.

### Changed
- Error notifications now append the underlying cause (e.g.
  `Impossible de changer d'apparence. [Token xyz does not exist]`), so problems can be
  diagnosed without opening the console.

## [0.0.5] — 2026-08-18

### Added
- Optional **Tokenizer** integration: a per-slot **Tokenize…** button in the GM config
  launches Tokenizer with a unique filename suffix and writes the token image (not the
  portrait) into that slot. Tokenizing the appearance currently on the canvas updates the
  token; tokenizing the other form only stores the file.
- GM out-of-sync HUD dialog can **assign** the current art to appearance A or B, so a
  sheet-launched Tokenizer save is not discarded. Players still revert to an approved form.

### Changed
- Config paths are stored normalized (query strings stripped). Duplicate detection uses the
  same path comparison as the HUD.
- *Use current as A* reads the art-mode field (ring subject vs standard texture).

## [0.0.4] — 2026-08-12

### Added
- GM world setting **Appearance transition**: choose the Foundry texture-transition
  effect used when a token switches images (default **Fade**). Rollback and newly
  placed token reconciliation stay instant so they do not replay the effect.

### Changed
- Repository hygiene for open source: relocated the design doc to `docs/DESIGN.md`, added
  this changelog, README badges, `.gitattributes`, and `license` / `readme` / `bugs` /
  `changelog` fields in `module.json`.
- CI: bumped `actions/checkout` to v5.

## [0.0.3] — 2026-07-14

### Added
- GM-only per-token **edit modal** opened from the Token HUD (pen button): configure a
  token's two images straight from the table, scoped to that token's character. Defaults to
  enabled with prefilled labels. The global bulk configuration screen remains available.

## [0.0.2] — 2026-07-14

### Added
- Support for **unlinked tokens**: the switch button now appears on them and switches only
  that placed token (each unlinked token is independent), while linked tokens still update
  the whole character (all linked tokens + prototype).

### Fixed
- Missing HUD switch button on unlinked tokens.

## [0.0.1] — 2026-07-14

### Added
- Initial release. One-click Token HUD switch between two GM-approved appearances, GM-only
  configuration screen, path-free player→GM request relay with server-verified identity,
  multi-GM authority election, per-actor request queue, best-effort rollback, standard and
  Dynamic Token Ring art modes, `createToken` reconciliation, and EN + FR localization.

[Unreleased]: https://github.com/Heiiji/alternative-token-foundry/compare/v0.0.6...HEAD
[0.0.6]: https://github.com/Heiiji/alternative-token-foundry/releases/tag/v0.0.6
[0.0.5]: https://github.com/Heiiji/alternative-token-foundry/releases/tag/v0.0.5
[0.0.4]: https://github.com/Heiiji/alternative-token-foundry/releases/tag/v0.0.4
[0.0.3]: https://github.com/Heiiji/alternative-token-foundry/releases/tag/v0.0.3
[0.0.2]: https://github.com/Heiiji/alternative-token-foundry/releases/tag/v0.0.2
[0.0.1]: https://github.com/Heiiji/alternative-token-foundry/releases/tag/v0.0.1
