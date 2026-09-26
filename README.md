# GameShift

**Every game change you missed, including the ones nobody told you about.**

GameShift shows you what changed in a game while you were away, and what a new patch *really* did. It doesn't take patch notes at face value. It compares the game's actual data between versions, checks those results against the official notes, and flags:

| Flag | Meaning |
| --- | --- |
| **Silent change** | The data changed, but the patch notes never mention it. |
| **Vague in notes** | The notes say "adjusted" or "reduced" without numbers. GameShift fills in the real values. |
| **Notes are wrong** | The notes give numbers that don't match the data. |
| **Not in data** | The notes claim a change that never actually shipped. |
| **Noticed by players** | Community-tracked changes that don't show up in data (matchmaking, hit registration, drop rates…), each with a confidence level and sources. |

## Two ways to use it

### Catch me up (returning players)
Pick the date you last played (or the last version you played). GameShift then:

- lists every patch you missed and totals the silent, vague and misreported changes;
- rolls each stat's history into **one net change**. If a weapon went 24 → 22 → 24, you just see "changed, then changed back" instead of two changes you don't need to care about;
- shows full current stats for everything **new** since you left, rather than a pile of tweaks to things you've never seen;
- covers removed content, and items that came *and went* while you were away;
- puts the biggest undisclosed changes first under **"What the patch notes didn't tell you"**;
- lets you filter by category, buffs/nerfs, "only changes the notes missed", or search by name.

Tap a stat to see every step in its history, with which patch did what and how each step was disclosed.

### Patch deep-dive (current players)
Pick a patch to see every line of the official notes marked **Verified / Clarified / Incorrect / Not in data / Not tracked**. Where a note was vague, the real numbers appear next to it. Below the notes: every silent change in that patch, plus community findings.

The URL keeps your view (`#game=…&view=…&since=…&version=…`), so a report can be bookmarked or shared.

## Running it

```bash
npm install
npm run dev        # open http://localhost:5173
npm test           # engine + importer tests
npm run build      # static site in dist/
```

Terminal report:

```bash
npm run report -- ironvale 2026-02-01
```

The bundled game, **Ironvale Arena**, is a fictional hero shooter used as sample data. Its six versions include every kind of change GameShift detects.

## How it works

```
data/games/<id>/snapshots/*.json ─┐
                                  ├─► diff ─► reconcile ─► catch-up / patch analysis ─► UI
data/games/<id>/notes/*.json ─────┘          ▲
data/games/<id>/reports.json ────────────────┘
```

- `src/core/diff.ts` compares consecutive snapshots and classifies each change as a buff or nerf using each stat's polarity (for example, lower reload time is better).
- `src/core/linker.ts` reads free-text patch notes and links them to entities and stats. It picks up claimed numbers too (`24 → 22`, `from 400 to 450`, `reduced to 8s`), follows a subject across clauses (`Stormcaller: damage 24 → 22, fire rate 600 → 640`), and knows that a bug-fix line naming a weapon isn't disclosing a balance change.
- `src/core/reconcile.ts` matches detected changes with note lines and decides how each change was disclosed and whether each note checks out.
- `src/core/catchup.ts` builds a returning player's report by comparing the version they left on with today. This stays correct even when content was removed and later brought back reworked.

## Adding a real game

Each game is a folder in `data/games/<id>/`. The app picks up new folders automatically.

**`game.json`**: name, plus metadata for each stat (label, unit, whether higher is better, aliases the note linker should recognise):

```json
{
  "id": "mygame",
  "name": "My Game",
  "kinds": { "weapon": "Weapons", "hero": "Heroes" },
  "statMeta": {
    "damage": { "label": "damage", "better": "higher" },
    "reload_time": { "label": "reload time", "unit": "s", "better": "lower", "aliases": ["reload"] }
  }
}
```

**`notes/<version>.json`**: official patch notes. You can import these straight from Steam for any Steam game:

```bash
npm run ingest:steam -- <steam-appid> <game-id> "Game Name"
```

Each entry is a line of text plus a category (`balance`, `content`, `systems`, `bugfix`, `ui`, `other`). When the automatic linker misreads a line, you can add explicit `refs`.

**`snapshots/<version>.json`**: the tracked game values for a version. These power silent-change detection:

```json
{
  "version": "1.2",
  "date": "2026-03-20",
  "entities": {
    "stormcaller": { "name": "Stormcaller", "kind": "weapon", "stats": { "damage": 22, "reload_time": 2.2 } }
  }
}
```

Snapshots come from whatever the game exposes: extracted game files, official data APIs, or community datamining. Only notes and no snapshots yet? GameShift still shows a clean timeline of patch notes, labelled as unverified.

**`reports.json`** (optional): community-observed changes, each with a `confidence` (`confirmed` / `likely` / `unverified`) and source links.

## Project layout

```
src/core/     engine: types, diff, linker, reconcile, catch-up, formatting
src/ingest/   importers (Steam news → patch notes)
src/data/     loads data/games for the browser (Vite) and Node (scripts/tests)
src/ui/       React app
scripts/      CLI: terminal report, Steam importer
data/games/   game data (sample: ironvale)
```
