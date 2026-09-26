import { useMemo, useState } from "react";
import { buildCatchUp } from "../core/catchup";
import { formatDate, formatValue } from "../core/format";
import { timeline } from "../core/reconcile";
import type { EntityCatchUp, GameData, NetStatChange } from "../core/types";
import {
  Badge,
  DisclosureBadge,
  Empty,
  ImpactPill,
  NetStatRow,
  ReportCard,
  Section,
  StatLabel,
  Tile,
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

  const [kind, setKind] = useState<string>("all");
  const [impact, setImpact] = useState<ImpactFilter>("all");
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [showReverted, setShowReverted] = useState(false);
  const [query, setQuery] = useState("");

  const visibleChanges = (e: EntityCatchUp): NetStatChange[] =>
    e.changes.filter(
      (c) =>
        (showReverted || c.type !== "reverted") &&
        (impact === "all" || c.impact === impact) &&
        (!onlyHidden || c.hasSilent),
    );

  const q = query.trim().toLowerCase();
  const matches = (e: EntityCatchUp) =>
    (kind === "all" || e.kind === kind) && (!q || e.name.toLowerCase().includes(q));

  const newcomers = report.entities.filter((e) => e.status === "new" && matches(e));
  const changed = report.entities
    .filter((e) => e.status === "changed" && matches(e))
    .map((e) => ({ entity: e, changes: visibleChanges(e) }))
    .filter((x) => x.changes.length > 0);
  const gone = report.entities.filter((e) => (e.status === "removed" || e.status === "transient") && matches(e));

  const headlines = report.entities
    .filter((e) => e.status === "changed")
    .flatMap((e) => e.changes.filter((c) => c.hasSilent && c.type !== "reverted").map((c) => ({ e, c })))
    .sort((a, b) => Math.abs(b.c.pct ?? 0) - Math.abs(a.c.pct ?? 0))
    .slice(0, 6);

  const presentKinds = [...new Set(report.entities.map((e) => e.kind))];
  const first = versions[0];
  const upToDate = report.patches.length === 0;

  return (
    <div className="view">
      <div className="controls card">
        <label className="field">
          <span>When did you last play?</span>
          <input
            type="date"
            value={since}
            min={first?.date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => e.target.value && onSince(e.target.value)}
          />
        </label>
        <div className="field">
          <span>…or pick the last version you played</span>
          <div className="chips">
            {versions.slice(0, -1).map((v) => (
              <button
                key={v.version}
                className={`chip ${report.fromVersion === v.version ? "chip-on" : ""}`}
                onClick={() => onSince(v.date)}
              >
                v{v.version}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="summary">
        <p className="summary-lead">
          You left on <strong>v{report.fromVersion}</strong>. {game.info.name} is now on{" "}
          <strong>v{report.toVersion}</strong>
          {upToDate ? " — you're up to date." : "."}
        </p>
        {!upToDate && (
          <div className="tiles">
            <Tile value={report.totals.patches} label={report.totals.patches === 1 ? "patch missed" : "patches missed"} />
            <Tile value={report.totals.changes} label="changes found" />
            <Tile value={report.totals.silent} label="not in patch notes" tone="silent" />
            <Tile value={report.totals.unclear} label="vague or wrong in notes" tone="vague" />
            <Tile value={report.totals.buffs} label="net buffs" tone="buff" />
            <Tile value={report.totals.nerfs} label="net nerfs" tone="nerf" />
          </div>
        )}
      </div>

      {upToDate ? (
        <Empty>Nothing has changed since you last played. Check the patch deep-dive for details on the current version.</Empty>
      ) : (
        <>
          {headlines.length > 0 && (
            <Section title="What the patch notes didn't tell you" subtitle="The biggest changes that were left out of the notes, stated vaguely, or stated wrongly.">
              <div className="headlines">
                {headlines.map(({ e, c }) => {
                  const meta = c.stat ? game.info.statMeta[c.stat] : undefined;
                  const worst = worstDisclosure(c.history);
                  return (
                    <article key={`${e.entity}-${c.stat}`} className="headline card">
                      <header>
                        <span className="kind">{kinds[e.kind] ?? e.kind}</span>
                        {worst && <DisclosureBadge disclosure={worst} />}
                      </header>
                      <h3>{e.name}</h3>
                      <p>
                        <StatLabel stat={c.stat} meta={meta} /> {formatValue(c.from, meta)} → {formatValue(c.to, meta)}
                      </p>
                      <ImpactPill impact={c.impact} pct={c.pct} />
                    </article>
                  );
                })}
              </div>
            </Section>
          )}

          <div className="filters" role="toolbar" aria-label="Filter changes">
            <input
              type="search"
              placeholder="Search heroes, weapons, items…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search"
            />
            <div className="chips">
              <button className={`chip ${kind === "all" ? "chip-on" : ""}`} onClick={() => setKind("all")}>
                Everything
              </button>
              {presentKinds.map((k) => (
                <button key={k} className={`chip ${kind === k ? "chip-on" : ""}`} onClick={() => setKind(k)}>
                  {kinds[k] ?? k}
                </button>
              ))}
            </div>
            <div className="chips">
              {(["all", "buff", "nerf"] as const).map((i) => (
                <button key={i} className={`chip ${impact === i ? "chip-on" : ""}`} onClick={() => setImpact(i)}>
                  {i === "all" ? "Buffs & nerfs" : i === "buff" ? "Buffs" : "Nerfs"}
                </button>
              ))}
            </div>
            <label className="toggle">
              <input type="checkbox" checked={onlyHidden} onChange={(e) => setOnlyHidden(e.target.checked)} />
              Only changes the notes missed
            </label>
            <label className="toggle">
              <input type="checkbox" checked={showReverted} onChange={(e) => setShowReverted(e.target.checked)} />
              Show changes that were undone ({report.totals.reverted})
            </label>
          </div>

          {newcomers.length > 0 && (
            <Section title="New since you left" subtitle="Current stats for everything added while you were away.">
              <div className="grid">
                {newcomers.map((e) => {
                  const entity = latest?.entities[e.entity];
                  const added = e.changes[0]?.history[0];
                  return (
                    <article key={e.entity} className="card entity">
                      <header className="entity-head">
                        <div>
                          <span className="kind">{kinds[e.kind] ?? e.kind}</span>
                          <h3>{e.name}</h3>
                        </div>
                        <Badge tone="new">New{added ? ` in v${added.version}` : ""}</Badge>
                      </header>
                      {added && <DisclosureBadge disclosure={added.disclosure} />}
                      {entity && (
                        <dl className="stats">
                          {Object.entries(entity.stats).map(([stat, value]) => (
                            <div key={stat}>
                              <dt>
                                <StatLabel stat={stat} meta={game.info.statMeta[stat]} />
                              </dt>
                              <dd>{formatValue(value, game.info.statMeta[stat])}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </article>
                  );
                })}
              </div>
            </Section>
          )}

          <Section title="What changed" subtitle="Net effect of every patch you missed. Tap a row to see each step.">
            {changed.length === 0 ? (
              <Empty>No changes match these filters.</Empty>
            ) : (
              <div className="grid">
                {changed.map(({ entity: e, changes }) => (
                  <article key={e.entity} className="card entity">
                    <header className="entity-head">
                      <div>
                        <span className="kind">{kinds[e.kind] ?? e.kind}</span>
                        <h3>{e.name}</h3>
                      </div>
                      {e.impact !== "neutral" && <ImpactPill impact={e.impact} />}
                    </header>
                    {e.events.length > 0 && (
                      <p className="events">
                        {e.events.map((ev) => `${ev.type === "added" ? "Returned" : "Removed"} in v${ev.version}`).join(" · ")}
                      </p>
                    )}
                    <ul className="stat-list">
                      {changes.map((c) => (
                        <NetStatRow key={c.stat} change={c} meta={c.stat ? game.info.statMeta[c.stat] : undefined} />
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </Section>

          {gone.length > 0 && (
            <Section title="Gone" subtitle="Removed from the game, or added and removed again while you were away.">
              <ul className="gone">
                {gone.map((e) => {
                  const events = e.changes[0]?.history ?? [];
                  return (
                    <li key={e.entity} className="card">
                      <strong>{e.name}</strong> <span className="muted">{kinds[e.kind] ?? e.kind}</span>{" "}
                      <span className="muted">
                        {events.map((ev) => `${ev.type === "added" ? "added" : "removed"} in v${ev.version}`).join(", ")}
                      </span>{" "}
                      {events.some((ev) => ev.disclosure === "silent") && <DisclosureBadge disclosure="silent" />}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {report.reports.length > 0 && (
            <Section title="Noticed by players" subtitle="Changes that don't show up in game data, tracked by the community.">
              <div className="grid">
                {report.reports.map((r) => (
                  <ReportCard key={r.id} report={r} />
                ))}
              </div>
            </Section>
          )}

          <Section title="Patches you missed">
            <ol className="patch-list">
              {[...report.patches].reverse().map((p) => (
                <li key={p.version}>
                  <button className="patch-link card" onClick={() => onOpenPatch(p.version)}>
                    <span>
                      <strong>v{p.version}</strong> {p.notes?.title && <span>— {p.notes.title}</span>}
                    </span>
                    <span className="muted">{formatDate(p.date)}</span>
                    <span className="patch-counts">
                      {p.changes.length} changes
                      {p.silent.length > 0 && <Badge tone="silent">{p.silent.length} silent</Badge>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </Section>
        </>
      )}
    </div>
  );
}
