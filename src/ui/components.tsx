import { useState, type ReactNode } from "react";
import { formatDate, formatPct, formatValue } from "../core/format";
import type {
  Disclosure,
  Impact,
  NetStatChange,
  NoteStatus,
  ReconciledChange,
  ReportConfidence,
  StatMeta,
  CommunityReport,
} from "../core/types";

export const DISCLOSURE_LABEL: Record<Disclosure, string> = {
  documented: "In patch notes",
  vague: "Vague in notes",
  mismatch: "Notes are wrong",
  silent: "Silent change",
};

const DISCLOSURE_HELP: Record<Disclosure, string> = {
  documented: "The official notes describe this change accurately.",
  vague: "The notes mention this, but don't say by how much.",
  mismatch: "The notes give numbers that don't match the game data.",
  silent: "This change isn't mentioned in the official notes at all.",
};

export const NOTE_STATUS: Record<NoteStatus, { label: string; help: string }> = {
  verified: { label: "Verified", help: "Matches the game data." },
  clarified: { label: "Clarified", help: "The note was vague — here are the actual numbers." },
  mismatch: { label: "Incorrect", help: "The numbers in this note don't match the game data." },
  missing: { label: "Not in data", help: "This change couldn't be found in the game data." },
  unverifiable: { label: "Not tracked", help: "Not something GameShift can check against game data." },
};

export function Badge({ tone, children, title }: { tone: string; children: ReactNode; title?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function DisclosureBadge({ disclosure }: { disclosure: Disclosure }) {
  if (disclosure === "documented") return null;
  return (
    <Badge tone={disclosure} title={DISCLOSURE_HELP[disclosure]}>
      {DISCLOSURE_LABEL[disclosure]}
    </Badge>
  );
}

export function ImpactPill({ impact, pct }: { impact: Impact; pct?: number }) {
  const label = impact === "buff" ? "Buff" : impact === "nerf" ? "Nerf" : "Change";
  return (
    <span className={`impact impact-${impact}`}>
      {impact === "buff" ? "▲" : impact === "nerf" ? "▼" : "●"} {label}
      {pct !== undefined && <span className="impact-pct">{formatPct(pct)}</span>}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: ReportConfidence }) {
  const labels = { confirmed: "Confirmed", likely: "Likely", unverified: "Unverified" };
  return <Badge tone={`conf-${confidence}`}>{labels[confidence]}</Badge>;
}

export function StatLabel({ stat, meta }: { stat?: string; meta?: StatMeta }) {
  const label = meta?.label ?? stat ?? "";
  return <span className="stat-label">{label.charAt(0).toUpperCase() + label.slice(1)}</span>;
}

export function Delta({ from, to, meta }: { from: unknown; to: unknown; meta?: StatMeta }) {
  return (
    <span className="delta">
      <span className="delta-from">{formatValue(from as never, meta)}</span>
      <span className="delta-arrow" aria-label="changed to">
        →
      </span>
      <span className="delta-to">{formatValue(to as never, meta)}</span>
    </span>
  );
}

/** One stat's net change for a returning player, with its patch-by-patch history. */
export function NetStatRow({ change, meta }: { change: NetStatChange; meta?: StatMeta }) {
  const [open, setOpen] = useState(false);
  const reverted = change.type === "reverted";
  const worst = worstDisclosure(change.history);
  const expandable = change.history.length > 0;

  return (
    <li className={`stat-row ${reverted ? "stat-row-reverted" : ""}`}>
      <button
        className="stat-row-main"
        onClick={() => expandable && setOpen(!open)}
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
      >
        <StatLabel stat={change.stat} meta={meta} />
        {reverted ? (
          <span className="delta-to">{formatValue(change.from, meta)}</span>
        ) : (
          <Delta from={change.from} to={change.to} meta={meta} />
        )}
        <span className="stat-row-tags">
          {reverted ? (
            <span className="reverted-note">Changed, then changed back</span>
          ) : (
            <ImpactPill impact={change.impact} pct={change.pct} />
          )}
          {worst && <DisclosureBadge disclosure={worst} />}
          {expandable && <span className={`chevron ${open ? "chevron-open" : ""}`} aria-hidden />}
        </span>
      </button>
      {open && <History history={change.history} meta={meta} />}
    </li>
  );
}

export function worstDisclosure(history: ReconciledChange[]): Disclosure | undefined {
  const order: Disclosure[] = ["silent", "mismatch", "vague"];
  return order.find((d) => history.some((h) => h.disclosure === d));
}

export function History({ history, meta }: { history: ReconciledChange[]; meta?: StatMeta }) {
  return (
    <ol className="history">
      {history.map((h) => (
        <li key={`${h.version}-${h.stat}`} className={`history-step history-${h.disclosure}`}>
          <span className="history-version">
            v{h.version} <span className="muted">· {formatDate(h.date)}</span>
          </span>
          <Delta from={h.from} to={h.to} meta={meta} />
          <DisclosureBadge disclosure={h.disclosure} />
          {h.disclosure !== "documented" && h.remark && <p className="history-remark">{h.remark}</p>}
        </li>
      ))}
    </ol>
  );
}

export function ReportCard({ report }: { report: CommunityReport }) {
  return (
    <article className="report">
      <header>
        <ConfidenceBadge confidence={report.confidence} />
        <span className="muted">v{report.version}</span>
      </header>
      <h4>{report.title}</h4>
      <p>{report.detail}</p>
      {report.sources.length > 0 && (
        <p className="sources">
          {report.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
              {s.label} ↗
            </a>
          ))}
        </p>
      )}
    </article>
  );
}

export function Tile({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  return (
    <div className={`tile ${tone ? `tile-${tone}` : ""}`}>
      <span className="tile-value">{value}</span>
      <span className="tile-label">{label}</span>
    </div>
  );
}

export function Section({ title, subtitle, children, id }: { title: string; subtitle?: string; children: ReactNode; id?: string }) {
  return (
    <section className="section" id={id}>
      <header className="section-head">
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
