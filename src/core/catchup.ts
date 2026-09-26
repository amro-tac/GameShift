import { classifyImpact, relativeChange } from "./diff";
import { analyzeHistory, sortSnapshots, timeline } from "./reconcile";
import type {
  CatchUpReport,
  Entity,
  EntityCatchUp,
  GameData,
  Impact,
  NetStatChange,
  ReconciledChange,
  Snapshot,
  StatMeta,
  StatValue,
} from "./types";

/**
 * The latest item released on or before `since` (or the oldest one if the
 * player predates our history). Items must be sorted oldest first.
 */
export function liveAt<T extends { date: string }>(items: T[], since: string): T | undefined {
  let base = items[0];
  for (const item of items) {
    if (item.date <= since) base = item;
  }
  return base;
}

/** The snapshot a player was on at `since`. */
export function baselineFor(snapshots: Snapshot[], since: string): Snapshot {
  const base = liveAt(sortSnapshots(snapshots), since);
  if (!base) throw new Error("no snapshots");
  return base;
}

function netEntity(history: ReconciledChange[]): NetStatChange {
  const first = history[0];
  const last = history[history.length - 1];
  const added = first.type === "added";
  const gone = last.type === "removed";
  return {
    entity: first.entity,
    entityName: last.entityName,
    kind: last.kind,
    type: added && gone ? "transient" : added ? "added" : gone ? "removed" : "reverted",
    impact: "neutral",
    history,
    hasSilent: history.some((c) => c.disclosure !== "documented"),
  };
}

function netStat(
  id: string,
  entity: Entity,
  stat: string,
  from: StatValue | undefined,
  to: StatValue | undefined,
  history: ReconciledChange[],
  meta: Record<string, StatMeta>,
): NetStatChange {
  const common = {
    entity: id,
    entityName: entity.name,
    kind: entity.kind,
    stat,
    from,
    to,
    history,
    hasSilent: history.some((c) => c.disclosure !== "documented"),
  };
  if (from === to) return { ...common, type: "reverted", impact: "neutral" };
  return {
    ...common,
    type: from === undefined ? "added" : to === undefined ? "removed" : "modified",
    impact: classifyImpact(from, to, meta[stat]),
    pct: relativeChange(from, to),
  };
}

function overallImpact(changes: NetStatChange[]): Impact {
  let score = 0;
  for (const c of changes) {
    if (c.type === "reverted") continue;
    const weight = Math.max(Math.abs(c.pct ?? 0), 0.05);
    if (c.impact === "buff") score += weight;
    if (c.impact === "nerf") score -= weight;
  }
  if (Math.abs(score) < 1e-9) return "neutral";
  return score > 0 ? "buff" : "nerf";
}

export interface CatchUpOptions {
  /** ISO date the player last played. */
  since: string;
}

export function buildCatchUp(game: GameData, { since }: CatchUpOptions): CatchUpReport {
  const versions = timeline(game);
  const current = liveAt(versions, since);
  const latestVersion = versions[versions.length - 1];
  if (!current || !latestVersion) throw new Error(`${game.info.id}: no versions`);

  const ordered = sortSnapshots(game.snapshots);
  const baseline = liveAt(ordered, since);
  const latest = ordered[ordered.length - 1];
  const patches = analyzeHistory(game).filter((p) => p.date > current.date);

  // Group every change by entity + stat, in chronological order.
  const groups = new Map<string, ReconciledChange[]>();
  for (const patch of patches) {
    for (const change of patch.changes) {
      const key = `${change.entity}\u0000${change.stat ?? ""}`;
      const list = groups.get(key) ?? [];
      list.push(change);
      groups.set(key, list);
    }
  }

  const byEntity = new Map<string, ReconciledChange[][]>();
  for (const history of groups.values()) {
    const list = byEntity.get(history[0].entity) ?? [];
    list.push(history);
    byEntity.set(history[0].entity, list);
  }

  const entities: EntityCatchUp[] = [];
  for (const [id, histories] of byEntity) {
    const before = baseline?.entities[id];
    const after = latest?.entities[id];
    const status: EntityCatchUp["status"] =
      !before && after ? "new" : before && !after ? "removed" : !before ? "transient" : "changed";

    let shown: NetStatChange[];
    if (status === "changed") {
      // Compare the player's version with today directly. This stays correct
      // even when an entity was removed and later re-added with new stats,
      // where the per-patch diff only records entity-level events.
      const statHistory = new Map(histories.filter((h) => h[0].stat).map((h) => [h[0].stat!, h]));
      const stats = new Set([...Object.keys(before!.stats), ...Object.keys(after!.stats), ...statHistory.keys()]);
      shown = [];
      for (const stat of stats) {
        const from = before!.stats[stat];
        const to = after!.stats[stat];
        const history = statHistory.get(stat) ?? [];
        if (from === to && history.length === 0) continue;
        shown.push(netStat(id, after!, stat, from, to, history, game.info.statMeta));
      }
    } else {
      // For entities the player has never seen (or that are gone), individual
      // stat tweaks are noise: show the entity-level entry; the UI lists stats.
      shown = histories.filter((h) => !h[0].stat).map((h) => netEntity(h));
    }
    if (shown.length === 0) continue;

    const entity = after ?? before ?? { name: histories[0][0].entityName, kind: histories[0][0].kind };
    entities.push({
      entity: id,
      name: entity.name,
      kind: entity.kind,
      status,
      events: histories.filter((h) => !h[0].stat).flat(),
      changes: shown.sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0)),
      impact: status === "changed" ? overallImpact(shown) : "neutral",
      magnitude: Math.max(0, ...shown.filter((c) => c.type !== "reverted").map((c) => Math.abs(c.pct ?? 0))),
    });
  }

  const statusOrder = { new: 0, changed: 1, removed: 2, transient: 3 } as const;
  entities.sort(
    (a, b) => statusOrder[a.status] - statusOrder[b.status] || b.magnitude - a.magnitude || a.name.localeCompare(b.name),
  );

  const flat = patches.flatMap((p) => p.changes);
  const netStats = entities.filter((e) => e.status === "changed").flatMap((e) => e.changes);

  return {
    since,
    fromVersion: current.version,
    toVersion: latestVersion.version,
    patches,
    entities,
    reports: patches.flatMap((p) => p.reports),
    totals: {
      patches: patches.length,
      changes: flat.length,
      silent: flat.filter((c) => c.disclosure === "silent").length,
      unclear: flat.filter((c) => c.disclosure === "vague" || c.disclosure === "mismatch").length,
      buffs: netStats.filter((c) => c.impact === "buff").length,
      nerfs: netStats.filter((c) => c.impact === "nerf").length,
      reverted: netStats.filter((c) => c.type === "reverted").length,
    },
  };
}
