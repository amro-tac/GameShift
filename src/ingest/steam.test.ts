import { describe, expect, it } from "vitest";
import { extractVersion, guessCategory, isPatchPost, parseSteamPost, type SteamNewsItem } from "./steam";

const post: SteamNewsItem = {
  gid: "1",
  title: "Patch 2.4.1 Notes",
  url: "https://store.steampowered.com/news/app/1/view/1",
  date: Date.UTC(2026, 5, 3) / 1000,
  feedname: "steam_community_announcements",
  tags: ["patchnotes"],
  contents: [
    "Hello everyone! This patch brings weapon tuning &amp; fixes.",
    "[h2]Balance Changes[/h2]",
    "[list][*]Stormcaller: damage 24 → 22[*][b]Brakka[/b] health increased to 450[/list]",
    "[h2]Bug Fixes[/h2]",
    "[list][*]Fixed a crash when leaving a lobby[*]Resolved [url=https://x]an issue[/url] with audio[/list]",
    "[img]{STEAM_CLAN_IMAGE}/banner.png[/img]",
  ].join("\n"),
};

describe("parseSteamPost", () => {
  const notes = parseSteamPost(post);

  it("reads version, date and intro", () => {
    expect(notes.version).toBe("2.4.1");
    expect(notes.date).toBe("2026-06-03");
    expect(notes.summary).toBe("Hello everyone! This patch brings weapon tuning & fixes.");
  });

  it("turns bullets into categorised entries", () => {
    expect(notes.entries.map((e) => [e.category, e.text])).toEqual([
      ["balance", "Stormcaller: damage 24 → 22"],
      ["balance", "Brakka health increased to 450"],
      ["bugfix", "Fixed a crash when leaving a lobby"],
      ["bugfix", "Resolved an issue with audio"],
    ]);
  });

  it("handles plain-text posts with dashed lists", () => {
    const plain = parseSteamPost({
      ...post,
      title: "Hotfix",
      contents: "Gameplay:\n- Respawn timer reduced to 8s\n- New map: Harbor",
    });
    expect(plain.version).toBe("2026-06-03");
    expect(plain.entries.map((e) => e.text)).toEqual(["Respawn timer reduced to 8s", "New map: Harbor"]);
  });
});

describe("helpers", () => {
  it("detects patch posts", () => {
    expect(isPatchPost(post)).toBe(true);
    expect(isPatchPost({ ...post, tags: [], feedname: "pcgamer", title: "Patch 2.4 review" })).toBe(false);
    expect(isPatchPost({ ...post, tags: [], title: "Update 3.0 is live" })).toBe(true);
  });

  it("extracts versions", () => {
    expect(extractVersion("Update v1.12.3 notes")).toBe("1.12.3");
    expect(extractVersion("Season 3 is here")).toBeUndefined();
  });

  it("guesses categories", () => {
    expect(guessCategory("Anything", "Bug Fixes")).toBe("bugfix");
    expect(guessCategory("Matchmaking now considers party size")).toBe("systems");
  });
});
