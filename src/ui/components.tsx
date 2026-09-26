import { useState, type ReactNode } from "react";
import { formatDate, formatPct, formatValue } from "../core/format";
import type {
  CommunityReport,
  Disclosure,
  Impact,
  NetStatChange,
  NoteStatus,
  ReconciledChange,
  ReportConfidence,
  StatMeta,
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
  missing: { label: "Not shipped", help: "This change couldn't be found in the game data." },
  unverifiable: { label: "Not tracked", help: "Not something GameShift can check against game data." },
};

/** Store-style verdict for a set of buffs and nerfs ("Mostly Nerfed"). */
export function verdict(buffs: number, nerfs: number): { label: string; tone: "pos" | "mixed" | "neg" } {
  const total = buffs + nerfs;
  if (total === 0) return { label: "No balance changes", tone: "mixed" };
  const r = buffs / total;
  if (r >= 0.8) return { label: "Mostly Buffed", tone: "pos" };
  if (r >= 0.6) return { label: "Leaning Buffed", tone: "pos" };
  if (r > 0.4) return { label: "Mixed", tone: "mixed" };
  if (r > 0.2) return { label: "Leaning Nerfed", tone: "neg" };
  return { label: "Mostly Nerfed", tone: "neg" };
}

export function Tag({ tone = "plain", children, title }: { tone?: string; children: ReactNode; title?: string }) {
  return (
    <span className={`tag tag-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function DisclosureTag({ disclosure }: { disclosure: Disclosure }) {
  if (disclosure === "documented") return null;
  return (
    <Tag tone={disclosure} title={DISCLOSURE_HELP[disclosure]}>
      {DISCLOSURE_LABEL[disclosure]}
    </Tag>
  );
}

/**
 * The green/red box from store discounts, used for a change's size:
 * [ -33% | 1.5% → 1% ].
 */
export function DeltaBox({
  impact,
  pct,
  from,
  to,
  meta,
}: {
  impact: Impact;
  pct?: number;
  from?: unknown;
  to?: unknown;
  meta?: StatMeta;
}) {
  return (
    <span className={`deltabox deltabox-${impact}`}>
      <span className="deltabox-pct">{pct !== undefined ? formatPct(pct) : impact === "neutral" ? "±" : ""}</span>
      <span className="deltabox-values">
        <span className="deltabox-from">{formatValue(from as never, meta)}</span>
        <span className="deltabox-to">{formatValue(to as never, meta)}</span>
      </span>
    </span>
  );
}

export function ImpactText({ impact }: { impact: Impact }) {
  if (impact === "neutral") return <span className="impact impact-neutral">Adjusted</span>;
  return <span className={`impact impact-${impact}`}>{impact === "buff" ? "▲ Buff" : "▼ Nerf"}</span>;
}

export function ConfidenceTag({ confidence }: { confidence: ReportConfidence }) {
  const labels = { confirmed: "Confirmed", likely: "Likely", unverified: "Unverified" };
  return <Tag tone={`conf-${confidence}`}>{labels[confidence]}</Tag>;
}

export function statName(stat: string | undefined, meta: StatMeta | undefined): string {
  const label = meta?.label ?? stat ?? "";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function worstDisclosure(history: ReconciledChange[]): Disclosure | undefined {
  const order: Disclosure[] = ["silent", "mismatch", "vague"];
  return order.find((d) => history.some((h) => h.disclosure === d));
}

/** One stat's net change for a returning player, expandable to its history. */
export function StatLine({ change, meta }: { change: NetStatChange; meta?: StatMeta }) {
  const [open, setOpen] = useState(false);
  const reverted = change.type === "reverted";
  const worst = worstDisclosure(change.history);
  const expandable = change.history.length > 0;

  return (
    <li className={`statline ${reverted ? "statline-reverted" : ""} ${open ? "statline-open" : ""}`}>
      <button className="statline-main" onClick={() => expandable && setOpen(!open)} aria-expanded={expandable ? open : undefined} disabled={!expandable}>
        <span className="statline-name">
          {statName(change.stat, meta)}
          {worst && <DisclosureTag disclosure={worst} />}
        </span>
        {reverted ? (
          <span className="statline-reverted-note">Changed &amp; reverted · {formatValue(change.from, meta)}</span>
        ) : (
          <DeltaBox impact={change.impact} pct={change.pct} from={change.from} to={change.to} meta={meta} />
        )}
        {expandable && <span className="caret" aria-hidden />}
      </button>
      {open && <History history={change.history} meta={meta} />}
    </li>
  );
}

export function History({ history, meta }: { history: ReconciledChange[]; meta?: StatMeta }) {
  return (
    <ol className="history">
      {history.map((h) => (
        <li key={`${h.version}-${h.stat}`} className={`history-step history-${h.disclosure}`}>
          <span className="history-version">
            v{h.version}
            <span className="dim"> {formatDate(h.date)}</span>
          </span>
          <span className="history-values">
            {formatValue(h.from, meta)} <span className="dim">→</span> <b>{formatValue(h.to, meta)}</b>
          </span>
          <DisclosureTag disclosure={h.disclosure} />
          {h.disclosure !== "documented" && h.remark && <p className="history-remark">{h.remark}</p>}
        </li>
      ))}
    </ol>
  );
}

export function ReportCard({ report }: { report: CommunityReport }) {
  return (
    <article className="report">
      <div className="report-meta">
        <ConfidenceTag confidence={report.confidence} />
        <span className="dim">Patch v{report.version}</span>
      </div>
      <h4>{report.title}</h4>
      <p>{report.detail}</p>
      {report.sources.length > 0 && (
        <p className="report-sources">
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

export function Section({
  title,
  subtitle,
  aside,
  children,
  id,
}: {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="section" id={id}>
      <header className="section-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
