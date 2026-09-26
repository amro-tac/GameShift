// Core data model for GameShift.
//
// A game's history is described by three kinds of input, all plain JSON so they
// can be produced by ingest scripts, dataminers, or written by hand:
//
//   1. Snapshots   – the full set of tracked game values at a given version
//                    (weapon damage, cooldowns, respawn timers, ...).
//   2. Patch notes – what the developers *said* changed in each version.
//   3. Reports     – community-observed changes that can't be seen in data
//                    (matchmaking behaviour, hit registration, drop rates...).
//
// The engine diffs consecutive snapshots to find what *actually* changed, then
// reconciles that against the notes to surface silent, vague and mismatched
// changes.

export type StatValue = number | string | boolean;

/** Whether a higher value is good for the player/entity that owns the stat. */
export type Polarity = "higher" | "lower" | "neutral";

export interface StatMeta {
  label: string;
  unit?: string;
  better?: Polarity;
  /** Extra words that should link a patch-note line to this stat. */
  aliases?: string[];
}

export interface Entity {
  name: string;
  /** Free-form grouping, e.g. "hero", "weapon", "item", "system". */
  kind: string;
  aliases?: string[];
  stats: Record<string, StatValue>;
}

export interface Snapshot {
  version: string;
  /** ISO date (YYYY-MM-DD) the version went live. */
  date: string;
  entities: Record<string, Entity>;
}

export type NoteCategory =
  | "balance"
  | "content"
  | "systems"
  | "bugfix"
  | "ui"
  | "other";

export interface StatClaim {
  stat: string;
  from?: number;
  to?: number;
}

export interface NoteRef {
  entity: string;
  stat?: string;
  claim?: StatClaim;
}

export interface NoteEntry {
  id: string;
  text: string;
  category: NoteCategory;
  /**
   * Optional explicit links to entities/stats. When omitted the linker infers
   * them from the text using entity names, stat labels and aliases.
   */
  refs?: NoteRef[];
}

export interface PatchNotes {
  version: string;
  date: string;
  title: string;
  url?: string;
  summary?: string;
  entries: NoteEntry[];
}

export type ReportConfidence = "confirmed" | "likely" | "unverified";

export interface CommunityReport {
  id: string;
  version: string;
  title: string;
  detail: string;
  category: NoteCategory;
  confidence: ReportConfidence;
  entity?: string;
  sources: { label: string; url: string }[];
}

export interface GameInfo {
  id: string;
  name: string;
  tagline?: string;
  /** Marks bundled sample data so the UI can say so. */
  sample?: boolean;
  statMeta: Record<string, StatMeta>;
  kinds?: Record<string, string>;
}

export interface GameData {
  info: GameInfo;
  snapshots: Snapshot[];
  notes: PatchNotes[];
  reports: CommunityReport[];
}

// ---------------------------------------------------------------------------
// Derived types produced by the engine
// ---------------------------------------------------------------------------

export type ChangeType = "modified" | "added" | "removed";
export type Impact = "buff" | "nerf" | "neutral";

export interface StatChange {
  version: string;
  date: string;
  entity: string;
  entityName: string;
  kind: string;
  type: ChangeType;
  stat?: string;
  from?: StatValue;
  to?: StatValue;
  impact: Impact;
  /** Relative change for numeric stats, e.g. -0.1 for a 10% reduction. */
  pct?: number;
}

/**
 * How a detected change relates to what the developers published.
 *  - documented: the notes mention it and any numbers they give are correct
 *  - vague:      the notes mention the entity/stat but not the actual values
 *  - mismatch:   the notes give numbers that don't match the data
 *  - silent:     the notes don't mention it at all
 */
export type Disclosure = "documented" | "vague" | "mismatch" | "silent";

export interface ReconciledChange extends StatChange {
  disclosure: Disclosure;
  noteIds: string[];
  /** Human-readable explanation when disclosure isn't "documented". */
  remark?: string;
}

/**
 * Verification status of a single patch-note line.
 *  - verified:     every change it refers to was found in the data
 *  - clarified:    it was vague; the engine found the concrete values
 *  - mismatch:     numbers in the note disagree with the data
 *  - unverifiable: the line doesn't map to tracked data (bug fixes, UI...)
 *  - missing:      the note claims a tracked change that isn't in the data
 */
export type NoteStatus =
  | "verified"
  | "clarified"
  | "mismatch"
  | "unverifiable"
  | "missing";

export interface AnnotatedNote extends NoteEntry {
  status: NoteStatus;
  refs: NoteRef[];
  changes: ReconciledChange[];
}

export interface PatchAnalysis {
  version: string;
  date: string;
  /** False when there are no snapshots to verify this version's notes. */
  hasData: boolean;
  notes: PatchNotes | undefined;
  annotated: AnnotatedNote[];
  changes: ReconciledChange[];
  silent: ReconciledChange[];
  reports: CommunityReport[];
}

/** A stat's journey across several patches, collapsed to its net effect. */
export interface NetStatChange {
  entity: string;
  entityName: string;
  kind: string;
  stat?: string;
  type: ChangeType | "reverted" | "transient";
  from?: StatValue;
  to?: StatValue;
  impact: Impact;
  pct?: number;
  history: ReconciledChange[];
  /** True if any step in the history was undisclosed or misreported. */
  hasSilent: boolean;
}

export interface EntityCatchUp {
  entity: string;
  name: string;
  kind: string;
  /** "transient" = added and removed again while the player was away. */
  status: "new" | "removed" | "changed" | "transient";
  changes: NetStatChange[];
  /** Entity-level events in the window (added, removed, re-added). */
  events: ReconciledChange[];
  impact: Impact;
  /** Largest absolute relative change, used for sorting headlines. */
  magnitude: number;
}

export interface CatchUpReport {
  since: string;
  fromVersion: string;
  toVersion: string;
  patches: PatchAnalysis[];
  entities: EntityCatchUp[];
  reports: CommunityReport[];
  totals: {
    patches: number;
    changes: number;
    silent: number;
    /** Changes the notes mentioned vaguely or with wrong numbers. */
    unclear: number;
    buffs: number;
    nerfs: number;
    reverted: number;
  };
}
