import type { Entity, NoteRef, StatMeta } from "./types";

// Infers which entities and stats a free-text patch-note line talks about, and
// extracts any concrete numbers it claims ("damage 24 → 22", "from 8s to 6s").
// Patch notes are written for humans, so this is deliberately forgiving: it only
// needs to be good enough to line notes up with the changes found in the data.

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
const UNIT = String.raw`\s*[a-z%]*`;
const ARROW = String.raw`\s*(?:→|->|=>|⇒|to)\s*`;
const RANGE_RE = new RegExp(`(?:from\\s+)?${NUM}${UNIT}${ARROW}${NUM}`, "i");
const TO_ONLY_RE = new RegExp(`\\b(?:to|now)\\s+${NUM}`, "i");

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordRe(term: string): RegExp {
  return new RegExp(`(?<![\\w])${escapeRe(term)}(?![\\w])`, "i");
}

function statTerms(stat: string, meta: StatMeta | undefined): string[] {
  const terms = [stat, stat.replace(/_/g, " ")];
  if (meta) terms.push(meta.label, ...(meta.aliases ?? []));
  return [...new Set(terms.map((t) => t.toLowerCase()))];
}

interface Match {
  index: number;
  length: number;
}

function firstMatch(text: string, terms: string[]): Match | undefined {
  let best: Match | undefined;
  for (const term of terms) {
    const m = wordRe(term).exec(text);
    if (!m) continue;
    // Prefer the earliest match; break ties with the longest term.
    if (!best || m.index < best.index || (m.index === best.index && term.length > best.length)) {
      best = { index: m.index, length: term.length };
    }
  }
  return best;
}

/** Split a note line into clauses, keeping "1,200" and "1.5" intact. */
function clauses(text: string): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  const re = /[;,](?=\s)|\.(?=\s|$)|:(?=\s)/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ text: text.slice(start, m.index), offset: start });
    start = m.index + 1;
  }
  out.push({ text: text.slice(start), offset: start });
  return out.filter((c) => c.text.trim().length > 0);
}

function parseClaim(stat: string, clause: string): NoteRef["claim"] | undefined {
  const range = RANGE_RE.exec(clause);
  if (range) return { stat, from: Number(range[1]), to: Number(range[2]) };
  const toOnly = TO_ONLY_RE.exec(clause);
  if (toOnly) return { stat, to: Number(toOnly[1]) };
  return undefined;
}

export function linkNote(
  text: string,
  entities: Record<string, Entity>,
  statMeta: Record<string, StatMeta>,
): NoteRef[] {
  const entityTerms = Object.entries(entities).map(([id, e]) => ({
    id,
    terms: [e.name, ...(e.aliases ?? [])].map((t) => t.toLowerCase()),
    stats: Object.keys(e.stats),
  }));

  const refs: NoteRef[] = [];
  const seen = new Set<string>();
  const push = (ref: NoteRef) => {
    const key = `${ref.entity}:${ref.stat ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };

  let current: (typeof entityTerms)[number] | undefined;
  for (const clause of clauses(text)) {
    // An entity mentioned in this clause becomes the subject for this and the
    // following clauses ("Stormcaller: damage 24 → 22, fire rate 600 → 640").
    let bestEntity: { e: (typeof entityTerms)[number]; m: Match } | undefined;
    for (const e of entityTerms) {
      const m = firstMatch(clause.text, e.terms);
      if (m && (!bestEntity || m.index < bestEntity.m.index || (m.index === bestEntity.m.index && m.length > bestEntity.m.length))) {
        bestEntity = { e, m };
      }
    }
    if (bestEntity) {
      current = bestEntity.e;
      push({ entity: current.id });
    }
    if (!current) continue;

    // Blank out the entity name so e.g. "Quickstep Boots" doesn't match a
    // "quickstep" stat alias.
    let body = clause.text;
    if (bestEntity) {
      const { index, length } = bestEntity.m;
      body = body.slice(0, index) + " ".repeat(length) + body.slice(index + length);
    }

    for (const stat of current.stats) {
      const m = firstMatch(body, statTerms(stat, statMeta[stat]));
      if (!m) continue;
      const claim = parseClaim(stat, body.slice(m.index + m.length));
      push({ entity: current.id, stat, ...(claim ? { claim } : {}) });
    }
  }

  // Drop the bare entity ref when we found something more specific for it.
  return refs
    .filter((r) => r.stat !== undefined || !refs.some((o) => o.entity === r.entity && o.stat !== undefined))
    .map((r) => {
      // Single-value entities ("Respawn", "Supply Crate") are about that value
      // even when the note never names the stat.
      const stats = entities[r.entity].stats;
      const only = Object.keys(stats);
      if (r.stat !== undefined || only.length !== 1) return r;
      const claim = parseClaim(only[0], text);
      return { entity: r.entity, stat: only[0], ...(claim ? { claim } : {}) };
    });
}
