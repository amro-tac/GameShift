import type { NoteCategory, NoteEntry, PatchNotes } from "../core/types";

// Turns Steam news posts (ISteamNews/GetNewsForApp) into GameShift patch notes.
// Works for any Steam game without an API key. Steam posts are BBCode or HTML,
// so this extracts bullet points and uses section headings to categorise them.

export interface SteamNewsItem {
  gid: string;
  title: string;
  url: string;
  contents: string;
  /** Unix seconds. */
  date: number;
  feedlabel?: string;
  feedname?: string;
  tags?: string[];
}

export function steamNewsUrl(appid: number, count = 50): string {
  return `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=${count}&maxlength=0&format=json`;
}

export async function fetchSteamNews(appid: number, count = 50): Promise<SteamNewsItem[]> {
  const res = await fetch(steamNewsUrl(appid, count));
  if (!res.ok) throw new Error(`Steam news request failed: ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { appnews?: { newsitems?: SteamNewsItem[] } };
  return body.appnews?.newsitems ?? [];
}

const PATCH_TITLE = /\b(patch|hotfix|update|release notes|changelog|balance)\b/i;

/** Official developer posts that look like patch notes (not press coverage). */
export function isPatchPost(item: SteamNewsItem): boolean {
  if (item.tags?.includes("patchnotes")) return true;
  const official = item.feedname === "steam_community_announcements" || item.feedlabel === "Community Announcements";
  return official && PATCH_TITLE.test(item.title);
}

export function extractVersion(title: string): string | undefined {
  return /\bv?(\d+(?:\.\d+){1,3}[a-z]?)\b/i.exec(title)?.[1];
}

const CATEGORY_HINTS: [NoteCategory, RegExp][] = [
  ["bugfix", /\b(bug ?fix(es)?|fix(ed|es)?|crash|issue|resolved|exploit)\b/i],
  ["balance", /\b(balance|buff|nerf|weapon|hero|champion|agent|class|damage|cooldown|health|tuning)\b/i],
  ["content", /\b(new|content|map|mode|event|season|cosmetic|skin|added)\b/i],
  ["ui", /\b(ui|hud|interface|menu|settings|accessibility|audio|visual)\b/i],
  ["systems", /\b(system|matchmaking|ranked|progression|economy|xp|server|performance|netcode)\b/i],
];

export function guessCategory(text: string, heading?: string): NoteCategory {
  // Headings are the strongest signal ("Bug Fixes", "Balance Changes").
  for (const source of [heading, text]) {
    if (!source) continue;
    for (const [category, re] of CATEGORY_HINTS) if (re.test(source)) return category;
  }
  return "other";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** Normalise BBCode/HTML into lines, marking headings and bullets. */
function toLines(contents: string): { text: string; heading: boolean; bullet: boolean }[] {
  const normalised = contents
    .replace(/\r/g, "")
    .replace(/\[(h[1-6])\]([\s\S]*?)\[\/\1\]/gi, "\n#HEADING# $2\n")
    .replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, "\n#HEADING# $2\n")
    .replace(/\[\*\]|<li[^>]*>/gi, "\n#BULLET# ")
    .replace(/\[\/?(list|olist|p)\]|<\/?(ul|ol|p|div)[^>]*>|<\/li>|<br\s*\/?>/gi, "\n")
    .replace(/\[url=[^\]]*\]([\s\S]*?)\[\/url\]/gi, "$1")
    .replace(/\[img\][\s\S]*?\[\/img\]|<img[^>]*>/gi, "")
    .replace(/\[\/?[a-z0-9]+(=[^\]]*)?\]/gi, "")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(normalised)
    .split("\n")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("#HEADING#")) return { text: line.slice(9).trim(), heading: true, bullet: false };
      if (line.startsWith("#BULLET#")) return { text: line.slice(8).trim(), heading: false, bullet: true };
      const dashed = /^([-•*–]|\d+[.)])\s+(.*)$/.exec(line);
      if (dashed) return { text: dashed[2], heading: false, bullet: true };
      // A short line ending with ":" (or in all caps) reads as a heading.
      const heading = (line.length < 60 && line.endsWith(":")) || (line.length < 40 && line === line.toUpperCase() && /[A-Z]/.test(line));
      return { text: heading ? line.replace(/:$/, "") : line, heading, bullet: false };
    })
    .filter((l) => l.text.length > 0);
}

export function parseSteamPost(item: SteamNewsItem): PatchNotes {
  const date = new Date(item.date * 1000).toISOString().slice(0, 10);
  const version = extractVersion(item.title) ?? date;
  const lines = toLines(item.contents);
  const hasBullets = lines.some((l) => l.bullet);

  const entries: NoteEntry[] = [];
  const intro: string[] = [];
  let heading: string | undefined;
  for (const line of lines) {
    if (line.heading) {
      heading = line.text;
      continue;
    }
    // In bulleted posts, loose paragraphs before the first heading are intro text.
    if (hasBullets && !line.bullet) {
      if (!heading && entries.length === 0) intro.push(line.text);
      else if (line.text.length > 20) entries.push(entry(line.text, heading));
      continue;
    }
    entries.push(entry(line.text, heading));
  }

  function entry(text: string, section?: string): NoteEntry {
    return { id: `${version}-${entries.length + 1}`, text, category: guessCategory(text, section) };
  }

  return {
    version,
    date,
    title: item.title,
    url: item.url,
    ...(intro.length ? { summary: intro.join(" ") } : {}),
    entries,
  };
}
