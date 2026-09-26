import { useMemo } from "react";
import { formatDate, formatValue } from "../core/format";
import { analyzeHistory } from "../core/reconcile";
import type { AnnotatedNote, GameData, NoteCategory, ReconciledChange } from "../core/types";
import { Capsule } from "./Art";
import { DeltaBox, Empty, NOTE_STATUS, ReportCard, Section, statName, Tag } from "./components";

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
  const byCategory = CATEGORY_ORDER.map((c) => ({ category: c, notes: patch.annotated.filter((n) => n.category === c) })).filter(
    (g) => g.notes.length > 0,
  );
  const count = (...s: AnnotatedNote["status"][]) => patch.annotated.filter((n) => s.includes(n.status)).length;

  return (
    <div className="patchlayout">
      <nav className="patchnav" aria-label="Patches">
        <p className="eyebrow">Patch history</p>
        <select className="patchnav-select" value={patch.version} onChange={(e) => onVersion(e.target.value)} aria-label="Patch">
          {patches.map((p) => (
            <option key={p.version} value={p.version}>
              v{p.version} {p.notes?.title ? `— ${p.notes.title}` : ""}
            </option>
          ))}
        </select>
        <ul className="patchnav-list">
          {patches.map((p) => (
            <li key={p.version}>
              <button className={p.version === patch.version ? "is-on" : ""} onClick={() => onVersion(p.version)}>
                <span className="patchnav-title">
                  v{p.version} {p.notes?.title && <span>{p.notes.title}</span>}
                </span>
                <span className="patchnav-meta">
                  {formatDate(p.date)}
                  {p.silent.length > 0 && <Tag tone="silent">{p.silent.length} silent</Tag>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="view">
        <header className="patchhead">
          <Capsule id={`${game.info.id}-${patch.version}`} kind="system" title={`v${patch.version}`} className="patchhead-art" />
          <div className="patchhead-body">
            <p className="eyebrow">
              {formatDate(patch.date)} · Version {patch.version}
            </p>
            <h2>{patch.notes?.title ?? `Version ${patch.version}`}</h2>
            {patch.notes?.summary && <p className="lead">{patch.notes.summary}</p>}
            {patch.notes?.url && (
              <a className="btn" href={patch.notes.url} target="_blank" rel="noreferrer">
                Official patch notes ↗
              </a>
            )}
          </div>
        </header>

        {!patch.hasData && (
          <p className="notice">No game-data snapshot for this version yet — notes are shown as published and can't be checked.</p>
        )}

        <div className="scorebar">
          <div>
            <b>{patch.changes.length}</b>
            <span>Changes in data</span>
          </div>
          <div className="c-pos">
            <b>{count("verified")}</b>
            <span>Notes verified</span>
          </div>
          <div className="c-vague">
            <b>{count("clarified")}</b>
            <span>Vague notes clarified</span>
          </div>
          <div className="c-neg">
            <b>{count("mismatch", "missing")}</b>
            <span>Notes don't match</span>
          </div>
          <div className="c-silent">
            <b>{patch.silent.length}</b>
            <span>Silent changes</span>
          </div>
        </div>

        <Section title="Official notes, fact-checked" subtitle="Every line checked against the game data, with real numbers where the notes were vague">
          {byCategory.length === 0 ? (
            <Empty>No official notes were published for this version.</Empty>
          ) : (
            byCategory.map(({ category, notes }) => (
              <div key={category} className="notegroup">
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

        <Section title="Silent changes" subtitle="In the game data, but not mentioned anywhere in the patch notes">
          {patch.silent.length === 0 ? (
            <Empty>{patch.hasData ? "No silent changes in this patch." : "No game data to compare for this version."}</Empty>
          ) : (
            <ul className="rows rows-compact">
              {patch.silent.map((c) => (
                <SilentRow key={`${c.entity}-${c.stat ?? c.type}`} change={c} game={game} />
              ))}
            </ul>
          )}
        </Section>

        {patch.reports.length > 0 && (
          <Section title="Noticed by players" subtitle="Community findings that aren't visible in game data">
            <div className="reports">
              {patch.reports.map((r) => (
                <ReportCard key={r.id} report={r} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function NoteLine({ note, meta }: { note: AnnotatedNote; meta: GameData["info"]["statMeta"] }) {
  const status = NOTE_STATUS[note.status];
  const detail = note.changes.filter((c) => c.stat);
  return (
    <li className={`note note-${note.status}`}>
      <span className={`notestatus notestatus-${note.status}`} title={status.help}>
        {status.label}
      </span>
      <div className="note-body">
        <p>{note.text}</p>
        {note.status === "missing" && <p className="note-fix">This change isn't in the game data for this version.</p>}
        {detail.length > 0 && note.status !== "verified" && (
          <ul className="note-fixes">
            {detail.map((c) => {
              const m = c.stat ? meta[c.stat] : undefined;
              return (
                <li key={`${c.entity}-${c.stat}`}>
                  <span>
                    <b>{c.entityName}</b> {statName(c.stat, m).toLowerCase()}
                    {c.disclosure === "mismatch" && c.remark && <span className="note-remark">{c.remark}</span>}
                  </span>
                  <DeltaBox impact={c.impact} pct={c.pct} from={c.from} to={c.to} meta={m} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </li>
  );
}

function SilentRow({ change: c, game }: { change: ReconciledChange; game: GameData }) {
  const kinds = game.info.kinds ?? {};
  const meta = c.stat ? game.info.statMeta[c.stat] : undefined;
  let what: string;
  if (!c.stat) what = c.type === "added" ? "Added to the game" : "Removed from the game";
  else if (c.type === "modified") what = statName(c.stat, meta);
  else what = `${statName(c.stat, meta)} ${c.type === "added" ? `added (${formatValue(c.to, meta)})` : `removed (was ${formatValue(c.from, meta)})`}`;

  return (
    <li className="row">
      <Capsule id={c.entity} kind={c.kind} className="row-thumb" />
      <div className="row-body">
        <div className="row-head">
          <h3>{c.entityName}</h3>
          <span className="row-tags">
            <Tag>{kinds[c.kind] ?? c.kind}</Tag>
          </span>
        </div>
        <p className="dim">{what}</p>
      </div>
      {c.stat && c.type === "modified" && <DeltaBox impact={c.impact} pct={c.pct} from={c.from} to={c.to} meta={meta} />}
    </li>
  );
}
