import { diffSnapshots } from "./diff";
import { linkNote } from "./linker";
import type {
  AnnotatedNote,
  CommunityReport,
  Disclosure,
  GameData,
  NoteRef,
  NoteStatus,
  PatchAnalysis,
  PatchNotes,
  ReconciledChange,
  Snapshot,
  StatChange,
  StatMeta,
  StatValue,
} from "./types";
import { formatValue } from "./format";

const EPSILON = 1e-6;
const QUIET_CATEGORIES = new Set(["bugfix", "ui"]);

function sameNumber(a: number | undefined, b: StatValue | undefined): boolean {
  return a === undefined || (typeof b === "number" && Math.abs(a - b) < EPSILON);
}

function refMatches(ref: NoteRef, change: StatChange): boolean {
  if (ref.entity !== change.entity) return false;
  // A bare entity reference covers every change to that entity, and any
  // reference to an entity covers it being added or removed.
  return ref.stat === undefined || change.stat === undefined || ref.stat === change.stat;
}

/** How a single note ref discloses a single change. */
function relation(ref: NoteRef, change: StatChange, statMeta: Record<string, StatMeta>): { disclosure: Disclosure; remark?: string } {
  const meta = change.stat ? statMeta[change.stat] : undefined;
  const actual = `${formatValue(change.from, meta)} → ${formatValue(change.to, meta)}`;
  const label = meta?.label ?? change.stat;

  if (!change.stat) {
    // Entity added/removed: naming the entity is a full disclosure.
    return { disclosure: "documented" };
  }
  if (ref.stat === undefined) {
    return {
      disclosure: "vague",
      remark: `Notes mention ${change.entityName} but not the ${label} change (${actual}).`,
    };
  }
  if (!ref.claim) {
    return {
      disclosure: "vague",
      remark: `Notes don't give numbers. Actual ${label}: ${actual}.`,
    };
  }
  if (sameNumber(ref.claim.to, change.to) && sameNumber(ref.claim.from, change.from)) {
    return { disclosure: "documented" };
  }
  const claimed =
    ref.claim.from !== undefined
      ? `${label} ${formatValue(ref.claim.from, meta)} → ${formatValue(ref.claim.to, meta)}`
      : `${label} is now ${formatValue(ref.claim.to, meta)}`;
  return {
    disclosure: "mismatch",
    remark: `Notes say ${claimed}, but the data shows ${actual}.`,
  };
}

const DISCLOSURE_RANK: Record<Disclosure, number> = {
  mismatch: 3,
  documented: 2,
  vague: 1,
  silent: 0,
};

/**
 * Analyse one version. `prev`/`next` are the snapshots either side of it; when
 * either is missing (a notes-only game, or the first tracked version) there is
 * nothing to verify against and every note is reported as unverifiable.
 */
export function analyzePatch(
  prev: Snapshot | undefined,
  next: Snapshot | undefined,
  notes: PatchNotes | undefined,
  reports: CommunityReport[],
  statMeta: Record<string, StatMeta>,
): PatchAnalysis {
  const version = next?.version ?? notes?.version;
  const date = next?.date ?? notes?.date;
  if (version === undefined || date === undefined) throw new Error("analyzePatch needs a snapshot or notes");
  const hasData = prev !== undefined && next !== undefined;
  const raw = hasData ? diffSnapshots(prev, next, statMeta) : [];
  // Link against both snapshots so notes can name removed entities.
  const known = { ...prev?.entities, ...next?.entities };

  const entries = (notes?.entries ?? []).map((entry) => ({
    entry,
    refs: entry.refs ?? linkNote(entry.text, known, statMeta),
  }));

  const changes: ReconciledChange[] = raw.map((change) => {
    let best: { disclosure: Disclosure; remark?: string } = { disclosure: "silent" };
    const noteIds: string[] = [];
    for (const { entry, refs } of entries) {
      const matching = refs.filter(
        (r) =>
          refMatches(r, change) &&
          // A bug-fix or UI line that merely names an entity ("fixed Longwatch
          // scope glint") doesn't disclose balance changes to it unless it
          // states concrete numbers.
          !(change.stat !== undefined && !r.claim && QUIET_CATEGORIES.has(entry.category)),
      );
      if (matching.length === 0) continue;
      noteIds.push(entry.id);
      for (const ref of matching) {
        const rel = relation(ref, change, statMeta);
        if (DISCLOSURE_RANK[rel.disclosure] > DISCLOSURE_RANK[best.disclosure]) best = rel;
      }
    }
    if (best.disclosure === "silent") {
      best.remark = "Not mentioned in the official patch notes.";
    }
    return { ...change, ...best, noteIds };
  });

  const annotated: AnnotatedNote[] = entries.map(({ entry, refs }) => {
    const linked = changes.filter((c) => c.noteIds.includes(entry.id));
    return { ...entry, refs, changes: linked, status: hasData ? noteStatus(entry.category, refs, linked, statMeta) : "unverifiable" };
  });

  return {
    version,
    date,
    hasData,
    notes,
    annotated,
    changes,
    silent: changes.filter((c) => c.disclosure === "silent"),
    reports: reports.filter((r) => r.version === version),
  };
}

function noteStatus(
  category: string,
  refs: NoteRef[],
  linked: ReconciledChange[],
  statMeta: Record<string, StatMeta>,
): NoteStatus {
  if (refs.length === 0) return "unverifiable";

  // Evaluate this note's own refs against the changes it links to.
  let status: NoteStatus = linked.length > 0 ? "verified" : "unverifiable";
  for (const ref of refs) {
    const hits = linked.filter((c) => refMatches(ref, c));
    if (hits.length === 0) {
      // Only call a claim "missing" when the note asserts a concrete balance
      // change; bug-fix lines often mention stats without changing them.
      if (ref.stat && (ref.claim || category === "balance")) return "missing";
      continue;
    }
    for (const c of hits) {
      const rel = relation(ref, c, statMeta).disclosure;
      if (rel === "mismatch") return "mismatch";
      if (rel === "vague") status = "clarified";
    }
  }
  return status;
}

export function sortSnapshots(snapshots: Snapshot[]): Snapshot[] {
  return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
}

export interface TimelineEntry {
  version: string;
  date: string;
  snapshot?: Snapshot;
  notes?: PatchNotes;
}

/** Every known version, from snapshots and/or notes, oldest first. */
export function timeline(game: Pick<GameData, "snapshots" | "notes">): TimelineEntry[] {
  const map = new Map<string, TimelineEntry>();
  for (const s of game.snapshots) map.set(s.version, { version: s.version, date: s.date, snapshot: s });
  for (const n of game.notes) {
    const entry = map.get(n.version) ?? { version: n.version, date: n.date };
    entry.notes = n;
    map.set(n.version, entry);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.version.localeCompare(b.version, undefined, { numeric: true }));
}

/** Analyse every patch in a game's history, oldest first. */
export function analyzeHistory(game: GameData): PatchAnalysis[] {
  const out: PatchAnalysis[] = [];
  let prev: Snapshot | undefined;
  for (const [i, entry] of timeline(game).entries()) {
    // The very first version is the starting point, not a patch, unless it
    // came with notes of its own.
    if (i > 0 || entry.notes) {
      const next = entry.snapshot;
      out.push(analyzePatch(next ? prev : undefined, next, entry.notes, game.reports, game.info.statMeta));
    }
    if (entry.snapshot) prev = entry.snapshot;
  }
  return out;
}
