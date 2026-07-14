# Changelog

All notable changes to this project are documented here. The format is loosely based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/Heiiji/alternative-token-foundry/compare/v0.0.3...HEAD
[0.0.3]: https://github.com/Heiiji/alternative-token-foundry/releases/tag/v0.0.3
[0.0.2]: https://github.com/Heiiji/alternative-token-foundry/releases/tag/v0.0.2
[0.0.1]: https://github.com/Heiiji/alternative-token-foundry/releases/tag/v0.0.1
