import type {
  Impact,
  Snapshot,
  StatChange,
  StatMeta,
  StatValue,
} from "./types";

export function classifyImpact(
  from: StatValue | undefined,
  to: StatValue | undefined,
  meta: StatMeta | undefined,
): Impact {
  if (typeof from === "boolean" && typeof to === "boolean") {
    if (!meta?.better || meta.better === "neutral") return "neutral";
    // For booleans "higher" means true is good.
    const good = meta.better === "higher" ? to : !to;
    return good ? "buff" : "nerf";
  }
  if (typeof from !== "number" || typeof to !== "number" || from === to) {
    return "neutral";
  }
  if (!meta?.better || meta.better === "neutral") return "neutral";
  const increased = to > from;
  return increased === (meta.better === "higher") ? "buff" : "nerf";
}

export function relativeChange(
  from: StatValue | undefined,
  to: StatValue | undefined,
): number | undefined {
  if (typeof from !== "number" || typeof to !== "number" || from === 0) {
    return undefined;
  }
  return (to - from) / Math.abs(from);
}

/** Compute every change between two consecutive snapshots. */
export function diffSnapshots(
  prev: Snapshot,
  next: Snapshot,
  statMeta: Record<string, StatMeta>,
): StatChange[] {
  const changes: StatChange[] = [];
  const base = { version: next.version, date: next.date };

  for (const [id, entity] of Object.entries(next.entities)) {
    const before = prev.entities[id];
    const common = { ...base, entity: id, entityName: entity.name, kind: entity.kind };
    if (!before) {
      changes.push({ ...common, type: "added", impact: "neutral" });
      continue;
    }
    const stats = new Set([
      ...Object.keys(before.stats),
      ...Object.keys(entity.stats),
    ]);
    for (const stat of stats) {
      const from = before.stats[stat];
      const to = entity.stats[stat];
      if (from === to) continue;
      const meta = statMeta[stat];
      changes.push({
        ...common,
        type: from === undefined ? "added" : to === undefined ? "removed" : "modified",
        stat,
        from,
        to,
        impact: classifyImpact(from, to, meta),
        pct: relativeChange(from, to),
      });
    }
  }

  for (const [id, entity] of Object.entries(prev.entities)) {
    if (next.entities[id]) continue;
    changes.push({
      ...base,
      entity: id,
      entityName: entity.name,
      kind: entity.kind,
      type: "removed",
      impact: "neutral",
    });
  }

  return changes;
}
