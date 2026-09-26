import { describe, expect, it } from "vitest";
import { diffSnapshots } from "./diff";
import { analyzePatch } from "./reconcile";
import type { PatchNotes, Snapshot, StatMeta } from "./types";

const meta: Record<string, StatMeta> = {
  damage: { label: "damage", better: "higher" },
  reload_time: { label: "reload time", unit: "s", better: "lower" },
  spread: { label: "spread", better: "lower" },
  health: { label: "health", better: "higher" },
  armor: { label: "armor", better: "higher" },
};

const v1: Snapshot = {
  version: "1.0",
  date: "2026-01-01",
  entities: {
    rifle: { name: "Stormcaller", kind: "weapon", stats: { damage: 24, reload_time: 2, spread: 1 } },
    sickles: { name: "Twin Sickles", kind: "weapon", stats: { damage: 55 } },
    tank: { name: "Brakka", kind: "hero", stats: { health: 400, armor: 150 } },
  },
};
const v2: Snapshot = {
  version: "1.1",
  date: "2026-02-01",
  entities: {
    rifle: { name: "Stormcaller", kind: "weapon", stats: { damage: 22, reload_time: 1.8, spread: 1.4 } },
    tank: { name: "Brakka", kind: "hero", stats: { health: 450, armor: 150 } },
    kiro: { name: "Kiro", kind: "hero", stats: { health: 175 } },
  },
};

describe("diffSnapshots", () => {
  it("finds modified, added and removed entities with impact", () => {
    const changes = diffSnapshots(v1, v2, meta);
    const byKey = Object.fromEntries(changes.map((c) => [`${c.entity}.${c.stat ?? c.type}`, c]));
    expect(byKey["rifle.damage"]).toMatchObject({ from: 24, to: 22, impact: "nerf" });
    expect(byKey["rifle.reload_time"]).toMatchObject({ impact: "buff" });
    expect(byKey["rifle.damage"].pct).toBeCloseTo(-0.0833, 3);
    expect(byKey["kiro.added"]).toBeDefined();
    expect(byKey["sickles.removed"]).toBeDefined();
    expect(changes).toHaveLength(6);
  });
});

describe("analyzePatch", () => {
  const notes: PatchNotes = {
    version: "1.1",
    date: "2026-02-01",
    title: "Test",
    entries: [
      { id: "a", category: "balance", text: "Stormcaller: damage 24 → 22." },
      { id: "b", category: "balance", text: "Stormcaller reload time improved." },
      { id: "c", category: "balance", text: "Brakka health increased to 475." },
      { id: "d", category: "content", text: "New hero: Kiro." },
      { id: "e", category: "balance", text: "Brakka armor 150 → 175." },
      { id: "f", category: "bugfix", text: "Fixed Stormcaller spread visuals." },
      { id: "g", category: "bugfix", text: "Fixed a crash on exit." },
    ],
  };
  const result = analyzePatch(v1, v2, notes, [], meta);
  const change = (entity: string, stat?: string) =>
    result.changes.find((c) => c.entity === entity && c.stat === stat)!;
  const note = (id: string) => result.annotated.find((n) => n.id === id)!;

  it("classifies how each change was disclosed", () => {
    expect(change("rifle", "damage").disclosure).toBe("documented");
    expect(change("rifle", "reload_time").disclosure).toBe("vague");
    expect(change("rifle", "reload_time").remark).toContain("2s → 1.8s");
    expect(change("tank", "health").disclosure).toBe("mismatch");
    expect(change("tank", "health").remark).toContain("475");
    expect(change("kiro").disclosure).toBe("documented");
    expect(change("sickles").disclosure).toBe("silent");
  });

  it("does not treat a bug-fix mention as disclosing a balance change", () => {
    expect(change("rifle", "spread").disclosure).toBe("silent");
    expect(result.silent.map((c) => c.entity + "." + (c.stat ?? ""))).toEqual(["rifle.spread", "sickles."]);
  });

  it("annotates each note line", () => {
    expect(note("a").status).toBe("verified");
    expect(note("b").status).toBe("clarified");
    expect(note("c").status).toBe("mismatch");
    expect(note("d").status).toBe("verified");
    expect(note("e").status).toBe("missing");
    expect(note("g").status).toBe("unverifiable");
  });
});
