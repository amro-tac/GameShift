import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { GameData } from "../core/types";
import { assembleGame, type GameFiles } from "./assemble";

export const DATA_DIR = join(import.meta.dirname, "..", "..", "data", "games");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : name.endsWith(".json") ? [full] : [];
  });
}

export function loadGame(id: string, dataDir = DATA_DIR): GameData {
  const root = join(dataDir, id);
  const files: GameFiles = {};
  for (const file of walk(root)) {
    files[relative(root, file).split(sep).join("/")] = JSON.parse(readFileSync(file, "utf8"));
  }
  return assembleGame(files);
}

export function listGames(dataDir = DATA_DIR): string[] {
  return readdirSync(dataDir).filter((d) => statSync(join(dataDir, d)).isDirectory());
}
