import { describe, expect, it } from "vitest";
import { linkNote } from "./linker";
import type { Entity, StatMeta } from "./types";

const meta: Record<string, StatMeta> = {
  damage: { label: "damage", better: "higher" },
  fire_rate: { label: "fire rate", unit: "rpm", better: "higher" },
  reload_time: { label: "reload time", unit: "s", better: "lower", aliases: ["reload"] },
  health: { label: "health", better: "higher" },
  respawn_time: { label: "respawn time", unit: "s", better: "lower" },
};
const entities: Record<string, Entity> = {
  rifle: { name: "Stormcaller", kind: "weapon", stats: { damage: 24, fire_rate: 600, reload_time: 2 } },
  tank: { name: "Brakka", kind: "hero", stats: { health: 400 } },
  respawn: { name: "Respawn", kind: "system", stats: { respawn_time: 10 } },
};

describe("linkNote", () => {
  it("links an entity, stat and arrow claim", () => {
    expect(linkNote("Stormcaller: damage 24 → 22.", entities, meta)).toEqual([
      { entity: "rifle", stat: "damage", claim: { stat: "damage", from: 24, to: 22 } },
    ]);
  });

  it("carries the subject across clauses and reads several stats", () => {
    const refs = linkNote("Stormcaller: damage 24 -> 22, fire rate 600rpm to 640rpm", entities, meta);
    expect(refs).toEqual([
      { entity: "rifle", stat: "damage", claim: { stat: "damage", from: 24, to: 22 } },
      { entity: "rifle", stat: "fire_rate", claim: { stat: "fire_rate", from: 600, to: 640 } },
    ]);
  });

  it("understands 'from X to Y' and 'to Y'", () => {
    expect(linkNote("Brakka health increased from 400 to 450", entities, meta)[0].claim).toEqual({
      stat: "health",
      from: 400,
      to: 450,
    });
    expect(linkNote("Stormcaller reload reduced to 1.8s", entities, meta)[0].claim).toEqual({
      stat: "reload_time",
      to: 1.8,
    });
  });

  it("keeps a vague mention without a claim", () => {
    expect(linkNote("Stormcaller fire rate adjusted.", entities, meta)).toEqual([{ entity: "rifle", stat: "fire_rate" }]);
    expect(linkNote("Stormcaller has been rebalanced.", entities, meta)).toEqual([{ entity: "rifle" }]);
  });

  it("infers the stat for single-value entities", () => {
    expect(linkNote("Respawn timer reduced to 8 seconds", entities, meta)).toEqual([
      { entity: "respawn", stat: "respawn_time", claim: { stat: "respawn_time", to: 8 } },
    ]);
  });

  it("returns nothing for unrelated lines", () => {
    expect(linkNote("Fixed a crash in the main menu.", entities, meta)).toEqual([]);
  });
});
