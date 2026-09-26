import { describe, expect, it } from "vitest";
import { baselineFor, buildCatchUp } from "./catchup";
import { loadGame } from "../data/node";

const game = loadGame("ironvale");

describe("baselineFor", () => {
  it("picks the version live on the given date", () => {
    expect(baselineFor(game.snapshots, "2026-03-19").version).toBe("1.1");
    expect(baselineFor(game.snapshots, "2026-03-20").version).toBe("1.2");
    expect(baselineFor(game.snapshots, "2020-01-01").version).toBe("1.0");
  });
});

describe("buildCatchUp", () => {
  const report = buildCatchUp(game, { since: "2026-01-20" });
  const entity = (id: string) => report.entities.find((e) => e.entity === id)!;
  const stat = (id: string, s: string) => entity(id).changes.find((c) => c.stat === s)!;

  it("covers every patch since the player left", () => {
    expect(report.fromVersion).toBe("1.0");
    expect(report.toVersion).toBe("1.5");
    expect(report.patches.map((p) => p.version)).toEqual(["1.1", "1.2", "1.3", "1.4", "1.5"]);
  });

  it("collapses a stat's history into its net change", () => {
    const respawn = stat("respawn", "respawn_time");
    expect(respawn).toMatchObject({ from: 10, to: 9, type: "modified", impact: "buff", hasSilent: true });
    expect(respawn.history.map((h) => h.version)).toEqual(["1.1", "1.3"]);
  });

  it("marks changes that were undone as reverted", () => {
    expect(stat("stormcaller", "damage").type).toBe("reverted");
    expect(stat("longwatch", "headshot_mult").type).toBe("reverted");
    expect(report.totals.reverted).toBe(2);
  });

  it("separates new, removed-and-returned and transient entities", () => {
    expect(entity("kiro").status).toBe("new");
    expect(entity("frost_lantern").status).toBe("transient");
    const sickles = entity("twin_sickles");
    expect(sickles.status).toBe("changed");
    expect(sickles.events.map((e) => `${e.version}:${e.type}`)).toEqual(["1.3:removed", "1.5:added"]);
    expect(sickles.changes.find((c) => c.stat === "damage")).toMatchObject({ from: 55, to: 60 });
  });

  it("hides tweaks to entities the player has never seen", () => {
    expect(entity("kiro").changes.every((c) => c.stat === undefined)).toBe(true);
    const later = buildCatchUp(game, { since: "2026-03-01" });
    expect(later.entities.find((e) => e.entity === "kiro")?.status).toBe("changed");
  });

  it("counts silent and unclear changes", () => {
    expect(report.totals.silent).toBeGreaterThan(0);
    expect(report.patches.flatMap((p) => p.silent).some((c) => c.entity === "supply_crate")).toBe(true);
    expect(report.reports).toHaveLength(4);
  });

  it("returns nothing to catch up on for current players", () => {
    const none = buildCatchUp(game, { since: "2026-09-01" });
    expect(none.patches).toHaveLength(0);
    expect(none.entities).toHaveLength(0);
  });
});

describe("notes-only games", () => {
  it("builds a timeline from notes when there are no snapshots", () => {
    const notesOnly = {
      info: { id: "x", name: "X", statMeta: {} },
      snapshots: [],
      reports: [],
      notes: [
        { version: "1.0", date: "2026-01-01", title: "Launch", entries: [] },
        { version: "1.1", date: "2026-02-01", title: "Patch", entries: [{ id: "a", category: "balance" as const, text: "Things 1 → 2" }] },
      ],
    };
    const r = buildCatchUp(notesOnly, { since: "2026-01-10" });
    expect(r.fromVersion).toBe("1.0");
    expect(r.patches.map((p) => [p.version, p.hasData])).toEqual([["1.1", false]]);
    expect(r.patches[0].annotated[0].status).toBe("unverifiable");
    expect(r.entities).toEqual([]);
  });
});
