import type { CommunityReport, GameData, GameInfo, PatchNotes, Snapshot } from "../core/types";
import { sortSnapshots } from "../core/reconcile";

/** Raw files for one game, keyed by path relative to data/games/<id>/. */
export type GameFiles = Record<string, unknown>;

export function assembleGame(files: GameFiles): GameData {
  const info = files["game.json"] as GameInfo | undefined;
  if (!info) throw new Error("game.json is missing");
  const snapshots: Snapshot[] = [];
  const notes: PatchNotes[] = [];
  for (const [file, content] of Object.entries(files)) {
    if (file.startsWith("snapshots/")) snapshots.push(content as Snapshot);
    if (file.startsWith("notes/")) notes.push(content as PatchNotes);
  }
  if (snapshots.length === 0 && notes.length === 0) {
    throw new Error(`${info.id}: needs at least one snapshot or patch-notes file`);
  }
  return {
    info,
    snapshots: sortSnapshots(snapshots),
    notes: notes.sort((a, b) => a.date.localeCompare(b.date)),
    reports: (files["reports.json"] as CommunityReport[] | undefined) ?? [],
  };
}
