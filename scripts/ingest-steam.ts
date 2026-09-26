// Import official patch notes for any Steam game.
//
//   npm run ingest:steam -- <appid> <game-id> ["Game Name"] [--count 100]
//   npm run ingest:steam -- 570 dota2 "Dota 2"
//
// Writes data/games/<game-id>/notes/<version>.json for every patch post found
// (existing files are left alone so hand edits survive), and creates a minimal
// game.json if the game is new. Add snapshots later to verify the notes.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameInfo } from "../src/core/types";
import { DATA_DIR } from "../src/data/node";
import { fetchSteamNews, isPatchPost, parseSteamPost } from "../src/ingest/steam";

const args = process.argv.slice(2);
const countFlag = args.indexOf("--count");
const count = countFlag >= 0 ? Number(args.splice(countFlag, 2)[1]) : 50;
const [appidArg, id, name] = args;
const appid = Number(appidArg);

if (!Number.isInteger(appid) || !id || !/^[a-z0-9-_]+$/.test(id)) {
  console.error('usage: npm run ingest:steam -- <appid> <game-id> ["Game Name"] [--count N]');
  process.exit(1);
}

const dir = join(DATA_DIR, id);
mkdirSync(join(dir, "notes"), { recursive: true });

const gameFile = join(dir, "game.json");
if (!existsSync(gameFile)) {
  const info: GameInfo = { id, name: name ?? id, tagline: `Patch notes imported from Steam (app ${appid})`, statMeta: {} };
  writeFileSync(gameFile, JSON.stringify(info, null, 2) + "\n");
  console.log(`created ${gameFile}`);
}

const items = (await fetchSteamNews(appid, count)).filter(isPatchPost);
let written = 0;
for (const item of items) {
  const notes = parseSteamPost(item);
  if (notes.entries.length === 0) continue;
  const file = join(dir, "notes", `${notes.version.replace(/[^\w.-]/g, "_")}.json`);
  if (existsSync(file)) continue;
  writeFileSync(file, JSON.stringify(notes, null, 2) + "\n");
  written++;
}
console.log(`${items.length} patch posts found, ${written} new notes written to ${join(dir, "notes")}`);
