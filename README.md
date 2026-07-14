# Alternative Token Foundry

A small, system-agnostic **Foundry VTT** module (V13+, verified on **V14**) that lets
**players** switch their character token between **two GM-approved appearances** — for
example *Normal* and *Armored* — with a single click in the Token HUD.

Switching a **linked** token updates every linked token (across all scenes) and the actor's
prototype token together, so the appearance belongs to the character and survives reloads.
Switching an **unlinked** token changes just that placed token, since each unlinked token is
independent. The GM keeps full control either way: players can only ever switch **between the
two images the GM configured** — they can never point a token at an arbitrary file.

---

## Install

In Foundry: **Add-on Modules → Install Module**, and paste this manifest URL:

```
https://github.com/Heiiji/alternative-token-foundry/releases/latest/download/module.json
```

Then enable **Alternative Token Foundry** in your world.

## GM setup

1. **Game Settings → Configure Settings → Alternative Token Images** (GM only).
2. For each player-owned character, set **Image A** and **Image B** (with the File Picker),
   give each a label (e.g. *Normal* / *Armored*), pick the **art mode**, and tick **Enabled**.
3. *Use current as A* prefills slot A from the token's current art; *Apply now* pushes an
   appearance to the character immediately. **Save changes** when done.

Both images are required, must differ, and both need a label before saving.

## Player use

Right-click your token to open the Token HUD and click the **masks** button. Your token
switches to the other appearance immediately; the tooltip tells you which form you'll get
("Switch to Armored"). Only owners of a configured character see the button. Works on both
linked tokens (updates the whole character) and unlinked tokens (updates that token only).

## Art modes

- **Standard token** — swaps `texture.src` (plain token images).
- **Dynamic ring subject** — swaps `ring.subject.texture` (Dynamic Token Ring frames).

Choose per character; mixed setups are fine.

## How it works (short version)

Approved images live in a **GM-only world setting**. A player click writes a tiny, path-free
**request flag** (`"a"`/`"b"`) to their owned actor; Foundry delivers it to the elected GM
with a server-verified user id; the GM validates ownership and applies the GM-approved image
to all linked tokens + the prototype, with best-effort rollback on failure. Multiple
connected GMs elect a single authority, and rapid clicks are serialized per actor. No socket,
no dependencies. Full design in [`docs/superpowers/specs`](docs/superpowers/specs/).

## Public API

```js
const api = game.modules.get("alternative-token-foundry")?.api;
await api.requestAppearanceChange(actor, "b"); // request slot B for an owned actor
```

## Development

```bash
npm install
npm test        # vitest — covers the pure logic (paths, slots, validation, election, sync plan)
```

Release: push a tag `vX.Y.Z`; GitHub Actions builds `module.zip`, stamps `module.json`, and
publishes a Release whose assets back the manifest/download URLs above.

---

## Français

Module **Foundry VTT** (V13+, vérifié en **V14**) permettant aux **joueurs** de basculer le
jeton de leur personnage entre **deux apparences approuvées par le MJ** (par ex. *Normal* /
*Armuré*) en un clic depuis le Token HUD. L'apparence appartient au **personnage** : tous les
jetons liés (sur toutes les scènes) et le jeton prototype sont mis à jour ensemble, et le
choix persiste après un rechargement. Les joueurs ne peuvent basculer qu'entre les **deux
images définies par le MJ**, jamais vers un fichier arbitraire.

- **Installation** : Modules → Installer un module, coller l'URL de manifeste ci-dessus.
- **MJ** : *Configurer les paramètres → Images de jeton alternatives* (réservé au MJ).
- **Joueur** : clic droit sur le jeton → bouton masques du HUD.

## License

MIT © 2026 Julien Juret
