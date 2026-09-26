import type { GameData } from "../core/types";
import { assembleGame, type GameFiles } from "./assemble";

// Every JSON file under data/games is bundled at build time. Drop a new game
// folder in there (see README) and it shows up in the app automatically.
const modules = import.meta.glob("../../data/games/*/**/*.json", { eager: true, import: "default" });

function load(): GameData[] {
  const byGame = new Map<string, GameFiles>();
  for (const [path, content] of Object.entries(modules)) {
    const m = /data\/games\/([^/]+)\/(.+)$/.exec(path);
    if (!m) continue;
    const files = byGame.get(m[1]) ?? {};
    files[m[2]] = content;
    byGame.set(m[1], files);
  }
  return [...byGame.values()].map(assembleGame).sort((a, b) => a.info.name.localeCompare(b.info.name));
}

export const games: GameData[] = load();
