import { useMemo, useState } from "react";
import { buildCatchUp } from "../core/catchup";
import { formatDate, formatValue } from "../core/format";
import { timeline } from "../core/reconcile";
import type { EntityCatchUp, GameData, NetStatChange } from "../core/types";
import { Capsule } from "./Art";
import {
  DeltaBox,
  DisclosureTag,
  DISCLOSURE_LABEL,
  Empty,
  ImpactText,
  ReportCard,
  Section,
  StatLine,
  statName,
  Tag,
  verdict,
  worstDisclosure,
} from "./components";

interface Props {
  game: GameData;
  since: string;
  onSince: (date: string) => void;
  onOpenPatch: (version: string) => void;
}

type ImpactFilter = "all" | "buff" | "nerf";

export function CatchUpView({ game, since, onSince, onOpenPatch }: Props) {
  const report = useMemo(() => buildCatchUp(game, { since }), [game, since]);
  const versions = useMemo(() => timeline(game), [game]);
  const latest = game.snapshots[game.snapshots.length - 1];
  const kinds = game.info.kinds ?? {};
  const meta = game.info.statMeta;
  const kindName = (k: string) => kinds[k] ?? k;

  const [kind, setKind] = useState<string>("all");
  const [impact, setImpact] = useState<ImpactFilter>("all");
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [showReverted, setShowReverted] = useState(false);
  const [query, setQuery] = useState("");

  const visibleChanges = (e: EntityCatchUp): NetStatChange[] =>
    e.changes.filter(
      (c) => (showReverted || c.type !== "reverted") && (impact === "all" || c.impact === impact) && (!onlyHidden || c.hasSilent),
    );
  const q = query.trim().toLowerCase();
  const matches = (e: EntityCatchUp) => (kind === "all" || e.kind === kind) && (!q || e.name.toLowerCase().includes(q));

  const newcomers = report.entities.filter((e) => e.status === "new");
  const changed = report.entities
    .filter((e) => e.status === "changed" && matches(e))
    .map((e) => ({ entity: e, changes: visibleChanges(e) }))
    .filter((x) => x.changes.length > 0);
  const gone = report.entities.filter((e) => e.status === "removed" || e.status === "transient");
  const changedKinds = [...new Set(report.entities.filter((e) => e.status === "changed").map((e) => e.kind))];

  const featured = report.entities
    .filter((e) => e.status === "changed")
    .flatMap((e) => e.changes.filter((c) => c.hasSilent && c.type !== "reverted").map((c) => ({ e, c })))
    .sort((a, b) => Math.abs(b.c.pct ?? 0) - Math.abs(a.c.pct ?? 0))
    .slice(0, 8);

  const upToDate = report.patches.length === 0;
  const left = versions.find((v) => v.version === report.fromVersion);
  const v = verdict(report.totals.buffs, report.totals.nerfs);

  return (
    <div className="view">
      <div className="welcome">
        <div className="welcome-main">
          <p className="eyebrow">Welcome back</p>
          <h2 className="welcome-title">
            You left on <span className="hl">v{report.fromVersion}</span>
            {left && <span className="welcome-date"> · {formatDate(left.date)}</span>}
          </h2>
          <label className="lastplayed">
            <span>Last played</span>
            <input
              type="date"
              value={since}
              min={versions[0]?.date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => e.target.value && onSince(e.target.value)}
            />
          </label>
          <div className="versionbar" role="group" aria-label="Last version you played">
            {versions.map((ver) => (
              <button
                key={ver.version}
                className={`versionbar-item ${ver.version === report.fromVersion ? "is-from" : ""} ${ver.version === report.toVersion ? "is-now" : ""}`}
                onClick={() => onSince(ver.date)}
                title={`I last played v${ver.version} (${formatDate(ver.date)})`}
              >
                v{ver.version}
              </button>
            ))}
          </div>
        </div>
        <dl className="infopanel">
          <div>
            <dt>Patches missed</dt>
            <dd>{report.totals.patches}</dd>
          </div>
          <div>
            <dt>Changes found</dt>
            <dd>{report.totals.changes}</dd>
          </div>
          <div>
            <dt>Not in patch notes</dt>
            <dd className="c-silent">{report.totals.silent}</dd>
          </div>
          <div>
            <dt>Vague or wrong in notes</dt>
            <dd className="c-vague">{report.totals.unclear}</dd>
          </div>
          <div className="infopanel-verdict">
            <dt>Overall balance</dt>
            <dd>
              <span className={`verdict verdict-${v.tone}`}>{v.label}</span>{" "}
              <span className="dim">
                ({report.totals.buffs} buffs · {report.totals.nerfs} nerfs)
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {upToDate ? (
        <Empty>You're up to date — nothing has changed since you last played. Open Patch Notes to dig into the current version.</Empty>
      ) : (
        <>
          {featured.length > 0 && (
            <Section title="What the patch notes didn't tell you" subtitle="Biggest changes that were left out of the notes, stated vaguely, or stated wrongly">
              <div className="carousel">
                {featured.map(({ e, c }) => {
                  const m = c.stat ? meta[c.stat] : undefined;
                  const worst = worstDisclosure(c.history);
                  return (
                    <article key={`${e.entity}-${c.stat}`} className="feature">
                      <Capsule id={e.entity} kind={e.kind} title={e.name} />
                      <div className="feature-body">
                        <h3>{e.name}</h3>
                        <p className="feature-stat">{statName(c.stat, m)}</p>
                        <p className={`feature-flag flag-${worst}`}>{worst && DISCLOSURE_LABEL[worst]}</p>
                        <div className="feature-foot">
                          <ImpactText impact={c.impact} />
                          <DeltaBox impact={c.impact} pct={c.pct} from={c.from} to={c.to} meta={m} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </Section>
          )}

          {newcomers.length > 0 && (
            <Section title="New since you left" subtitle="Everything added while you were away, with current stats">
              <div className="newgrid">
                {newcomers.map((e) => {
                  const entity = latest?.entities[e.entity];
                  const added = e.changes[0]?.history[0];
                  return (
                    <article key={e.entity} className="newcard">
                      <div className="newcard-art">
                        <Capsule id={e.entity} kind={e.kind} title={e.name} />
                        {added && <span className="ribbon">New in v{added.version}</span>}
                      </div>
                      <div className="newcard-body">
                        <div className="newcard-head">
                          <Tag>{kindName(e.kind)}</Tag>
                          {added && <DisclosureTag disclosure={added.disclosure} />}
                        </div>
                        {entity && (
                          <table className="stattable">
                            <tbody>
                              {Object.entries(entity.stats).map(([stat, value]) => (
                                <tr key={stat}>
                                  <th scope="row">{statName(stat, meta[stat])}</th>
                                  <td>{formatValue(value, meta[stat])}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </Section>
          )}

          <Section title="What changed" subtitle="Net effect of every patch you missed · tap a stat for its patch-by-patch history" id="changes">
            <div className="tabstrip" role="tablist" aria-label="Category">
              <button role="tab" aria-selected={kind === "all"} className={kind === "all" ? "is-on" : ""} onClick={() => setKind("all")}>
                All
              </button>
              {changedKinds.map((k) => (
                <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "is-on" : ""} onClick={() => setKind(k)}>
                  {kindName(k)}
                </button>
              ))}
            </div>
            <div className="filterbar">
              <input type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search by name" />
              <div className="segmented" role="group" aria-label="Buffs or nerfs">
                {(["all", "buff", "nerf"] as const).map((i) => (
                  <button key={i} className={impact === i ? "is-on" : ""} onClick={() => setImpact(i)}>
                    {i === "all" ? "Any" : i === "buff" ? "Buffs" : "Nerfs"}
                  </button>
                ))}
              </div>
              <label className="check">
                <input type="checkbox" checked={onlyHidden} onChange={(e) => setOnlyHidden(e.target.checked)} />
                Only what the notes missed
              </label>
              <label className="check">
                <input type="checkbox" checked={showReverted} onChange={(e) => setShowReverted(e.target.checked)} />
                Include reverted ({report.totals.reverted})
              </label>
            </div>

            {changed.length === 0 ? (
              <Empty>No changes match these filters.</Empty>
            ) : (
              <ul className="rows">
                {changed.map(({ entity: e, changes }) => {
                  const buffs = changes.filter((c) => c.impact === "buff").length;
                  const nerfs = changes.filter((c) => c.impact === "nerf").length;
                  return (
                    <li key={e.entity} className="row">
                      <Capsule id={e.entity} kind={e.kind} className="row-thumb" />
                      <div className="row-body">
                        <div className="row-head">
                          <h3>{e.name}</h3>
                          <span className="row-tags">
                            <Tag>{kindName(e.kind)}</Tag>
                            {e.events.map((ev) => (
                              <Tag key={ev.version} tone="info">
                                {ev.type === "added" ? "Returned" : "Removed"} v{ev.version}
                              </Tag>
                            ))}
                          </span>
                          {(buffs > 0 || nerfs > 0) && (
                            <span className={`verdict verdict-${e.impact === "buff" ? "pos" : e.impact === "nerf" ? "neg" : "mixed"} row-verdict`}>
                              {e.impact === "buff" ? "Buffed" : e.impact === "nerf" ? "Nerfed" : "Mixed"}
                            </span>
                          )}
                        </div>
                        <ul className="statlines">
                          {changes.map((c) => (
                            <StatLine key={c.stat} change={c} meta={c.stat ? meta[c.stat] : undefined} />
                          ))}
                        </ul>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {gone.length > 0 && (
            <Section title="No longer in the game" subtitle="Removed, or added and removed again while you were away">
              <ul className="rows rows-compact">
                {gone.map((e) => {
                  const events = e.changes[0]?.history ?? [];
                  return (
                    <li key={e.entity} className="row">
                      <Capsule id={e.entity} kind={e.kind} className="row-thumb" />
                      <div className="row-body">
                        <div className="row-head">
                          <h3>{e.name}</h3>
                          <span className="row-tags">
                            <Tag>{kindName(e.kind)}</Tag>
                            {events.some((ev) => ev.disclosure === "silent") && <DisclosureTag disclosure="silent" />}
                          </span>
                        </div>
                        <p className="dim">
                          {events.map((ev) => `${ev.type === "added" ? "Added" : "Removed"} in v${ev.version}`).join(" · ")}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {report.reports.length > 0 && (
            <Section title="Noticed by players" subtitle="Changes that don't show up in game data, tracked by the community">
              <div className="reports">
                {report.reports.map((r) => (
                  <ReportCard key={r.id} report={r} />
                ))}
              </div>
            </Section>
          )}

          <Section title="Patches you missed">
            <ul className="rows rows-compact">
              {[...report.patches].reverse().map((p) => (
                <li key={p.version}>
                  <button className="row row-link" onClick={() => onOpenPatch(p.version)}>
                    <Capsule id={`${game.info.id}-${p.version}`} kind="system" className="row-thumb" title={`v${p.version}`} />
                    <div className="row-body">
                      <div className="row-head">
                        <h3>{p.notes?.title ?? `Version ${p.version}`}</h3>
                        <span className="dim">{formatDate(p.date)}</span>
                      </div>
                      <p className="row-counts">
                        <span>{p.changes.length} changes</span>
                        {p.silent.length > 0 && <Tag tone="silent">{p.silent.length} silent</Tag>}
                      </p>
                    </div>
                    <span className="row-go" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}
