// Print a catch-up report in the terminal.
//
//   npm run report -- <game-id> <last-played YYYY-MM-DD>
//   npm run report -- ironvale 2026-02-01

import { buildCatchUp } from "../src/core/catchup";
import { formatPct, formatValue } from "../src/core/format";
import { listGames, loadGame } from "../src/data/node";

const [id, since] = process.argv.slice(2);
if (!id || !since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
  console.error(`usage: npm run report -- <game-id> <YYYY-MM-DD>\navailable games: ${listGames().join(", ")}`);
  process.exit(1);
}

const game = loadGame(id);
const r = buildCatchUp(game, { since });
const meta = game.info.statMeta;

console.log(`\n${game.info.name}: you left on ${r.fromVersion}, the game is now on ${r.toVersion}`);
console.log(
  `${r.totals.patches} patches · ${r.totals.changes} changes · ${r.totals.silent} silent · ${r.totals.unclear} vague/misreported\n`,
);

const TAG = { silent: "SILENT", vague: "VAGUE", mismatch: "MISREPORTED", documented: "" } as const;
for (const e of r.entities) {
  console.log(`${e.name} (${e.kind}) — ${e.status}${e.impact !== "neutral" ? `, overall ${e.impact}` : ""}`);
  for (const c of e.changes) {
    if (!c.stat) continue;
    const m = meta[c.stat];
    const label = m?.label ?? c.stat;
    const net =
      c.type === "reverted"
        ? `changed and changed back (${formatValue(c.from, m)})`
        : `${formatValue(c.from, m)} → ${formatValue(c.to, m)} ${formatPct(c.pct)} ${c.impact !== "neutral" ? c.impact : ""}`;
    console.log(`   ${label}: ${net}`);
    for (const h of c.history) {
      const tag = TAG[h.disclosure];
      console.log(`      ${h.version}: ${formatValue(h.from, m)} → ${formatValue(h.to, m)}${tag ? `  [${tag}] ${h.remark ?? ""}` : ""}`);
    }
  }
}
if (r.reports.length) {
  console.log("\nCommunity-observed changes:");
  for (const rep of r.reports) console.log(`  [${rep.version}] ${rep.title} (${rep.confidence})`);
}
