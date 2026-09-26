import { useMemo } from "react";
import { formatDate, formatValue } from "../core/format";
import { analyzeHistory } from "../core/reconcile";
import type { AnnotatedNote, GameData, NoteCategory, ReconciledChange } from "../core/types";
import { Badge, Delta, DisclosureBadge, Empty, ImpactPill, NOTE_STATUS, ReportCard, Section, StatLabel, Tile } from "./components";

interface Props {
  game: GameData;
  version: string | undefined;
  onVersion: (version: string) => void;
}

const CATEGORY_LABEL: Record<NoteCategory, string> = {
  content: "New content",
  balance: "Balance",
  systems: "Systems & economy",
  ui: "Interface",
  bugfix: "Bug fixes",
  other: "Other",
};
const CATEGORY_ORDER: NoteCategory[] = ["content", "balance", "systems", "ui", "bugfix", "other"];

export function PatchView({ game, version, onVersion }: Props) {
  const patches = useMemo(() => analyzeHistory(game).reverse(), [game]);
  const patch = patches.find((p) => p.version === version) ?? patches[0];
  if (!patch) return <Empty>No patches recorded for this game yet.</Empty>;

  const meta = game.info.statMeta;
  const byCategory = CATEGORY_ORDER.map((c) => ({
    category: c,
    notes: patch.annotated.filter((n) => n.category === c),
  })).filter((g) => g.notes.length > 0);
  const counts = {
    verified: patch.annotated.filter((n) => n.status === "verified").length,
    clarified: patch.annotated.filter((n) => n.status === "clarified").length,
    wrong: patch.annotated.filter((n) => n.status === "mismatch" || n.status === "missing").length,
  };

  return (
    <div className="view patch-view">
      <nav className="patch-nav card" aria-label="Patches">
        <label className="field">
          <span>Patch</span>
          <select value={patch.version} onChange={(e) => onVersion(e.target.value)}>
            {patches.map((p) => (
              <option key={p.version} value={p.version}>
                v{p.version}
                {p.notes?.title ? ` — ${p.notes.title}` : ""} ({formatDate(p.date)})
              </option>
            ))}
          </select>
        </label>
      </nav>

      <header className="patch-head">
        <p className="muted">
          v{patch.version} · {formatDate(patch.date)}
          {patch.notes?.url && (
            <>
              {" · "}
              <a href={patch.notes.url} target="_blank" rel="noreferrer">
                Official notes ↗
              </a>
            </>
          )}
        </p>
        <h2>{patch.notes?.title ?? `Version ${patch.version}`}</h2>
        {patch.notes?.summary && <p className="lead">{patch.notes.summary}</p>}
        {!patch.hasData && (
          <p className="notice">
            There's no game-data snapshot for this version yet, so these notes are shown as published and can't be checked.
          </p>
        )}
        <div className="tiles">
          <Tile value={patch.changes.length} label="changes in game data" />
          <Tile value={counts.verified} label="notes verified" tone="buff" />
          <Tile value={counts.clarified} label="vague notes clarified" tone="vague" />
          <Tile value={counts.wrong} label="notes that don't match" tone="nerf" />
          <Tile value={patch.silent.length} label="silent changes" tone="silent" />
        </div>
      </header>

      <Section title="Official patch notes, checked" subtitle="Each line compared against the game data, with the real numbers where the notes were vague.">
        {byCategory.length === 0 ? (
          <Empty>No official notes were published for this version.</Empty>
        ) : (
          byCategory.map(({ category, notes }) => (
            <div key={category} className="note-group">
              <h3>{CATEGORY_LABEL[category]}</h3>
              <ul className="notes">
                {notes.map((n) => (
                  <NoteLine key={n.id} note={n} meta={meta} />
                ))}
              </ul>
            </div>
          ))
        )}
      </Section>

      <Section title="Silent changes" subtitle="Found in the game data but not mentioned anywhere in the patch notes.">
        {patch.silent.length === 0 ? (
          <Empty>{patch.hasData ? "No silent changes found in this patch." : "No game data to compare for this version."}</Empty>
        ) : (
          <ul className="silent-list">
            {patch.silent.map((c) => (
              <SilentChange key={`${c.entity}-${c.stat ?? c.type}`} change={c} game={game} />
            ))}
          </ul>
        )}
      </Section>

      {patch.reports.length > 0 && (
        <Section title="Noticed by players" subtitle="Community findings that aren't visible in game data.">
          <div className="grid">
            {patch.reports.map((r) => (
              <ReportCard key={r.id} report={r} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function NoteLine({ note, meta }: { note: AnnotatedNote; meta: GameData["info"]["statMeta"] }) {
  const status = NOTE_STATUS[note.status];
  const detail = note.changes.filter((c) => c.stat);
  return (
    <li className={`note note-${note.status}`}>
      <div className="note-main">
        <Badge tone={`status-${note.status}`} title={status.help}>
          {status.label}
        </Badge>
        <p>{note.text}</p>
      </div>
      {note.status === "missing" && (
        <p className="note-detail">The notes describe this change, but it isn't in the game data for this version.</p>
      )}
      {detail.length > 0 && note.status !== "verified" && (
        <ul className="note-detail">
          {detail.map((c) => (
            <li key={`${c.entity}-${c.stat}`}>
              <strong>{c.entityName}</strong> <StatLabel stat={c.stat} meta={c.stat ? meta[c.stat] : undefined} />{" "}
              <Delta from={c.from} to={c.to} meta={c.stat ? meta[c.stat] : undefined} />{" "}
              <ImpactPill impact={c.impact} pct={c.pct} />
              {c.disclosure === "mismatch" && c.remark && <p className="history-remark">{c.remark}</p>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function SilentChange({ change: c, game }: { change: ReconciledChange; game: GameData }) {
  const kinds = game.info.kinds ?? {};
  const meta = c.stat ? game.info.statMeta[c.stat] : undefined;
  let body;
  if (!c.stat) {
    body = <span>{c.type === "added" ? "Added to the game" : "Removed from the game"}</span>;
  } else if (c.type === "modified") {
    body = (
      <>
        <StatLabel stat={c.stat} meta={meta} /> <Delta from={c.from} to={c.to} meta={meta} />{" "}
        <ImpactPill impact={c.impact} pct={c.pct} />
      </>
    );
  } else {
    body = (
      <>
        <StatLabel stat={c.stat} meta={meta} /> {c.type === "added" ? `added (${formatValue(c.to, meta)})` : `removed (was ${formatValue(c.from, meta)})`}
      </>
    );
  }
  return (
    <li className="card silent-item">
      <div>
        <span className="kind">{kinds[c.kind] ?? c.kind}</span>
        <strong>{c.entityName}</strong>
      </div>
      <div className="silent-body">{body}</div>
      <DisclosureBadge disclosure="silent" />
    </li>
  );
}
