import type { StatMeta, StatValue } from "./types";

const ATTACHED_UNITS = new Set(["s", "ms", "m", "°"]);

export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString("en-US");
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export function formatValue(value: StatValue | undefined, meta?: StatMeta): string {
  if (value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  const unit = meta?.unit;
  if (!unit) return formatNumber(value);
  if (unit === "%") return `${formatNumber(value)}%`;
  if (unit === "x") return `×${formatNumber(value)}`;
  return `${formatNumber(value)}${ATTACHED_UNITS.has(unit) ? unit : ` ${unit}`}`;
}

export function formatPct(pct: number | undefined): string {
  if (pct === undefined || !Number.isFinite(pct)) return "";
  const v = Math.round(pct * 1000) / 10;
  return `${v > 0 ? "+" : ""}${v}%`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
