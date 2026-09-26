// Generated artwork. Game data rarely comes with images, so every entity gets a
// deterministic tile built from its id: a dark graph-paper field, a trend line
// and a large outline icon for its kind, tinted with one colour per entity.

const HUES = [150, 45, 20, 280, 190, 340, 90, 0];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hueFor(id: string): number {
  return HUES[hash(id) % HUES.length];
}

function KindIcon({ kind }: { kind: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (kind) {
    case "hero":
      return (
        <g {...common}>
          <circle cx="50" cy="34" r="16" />
          <path d="M18 92c4-22 18-34 32-34s28 12 32 34" />
        </g>
      );
    case "weapon":
      return (
        <g {...common}>
          <circle cx="50" cy="50" r="26" />
          <circle cx="50" cy="50" r="3" fill="currentColor" />
          <path d="M50 8v22M50 70v22M8 50h22M70 50h22" />
        </g>
      );
    case "item":
      return (
        <g {...common}>
          <path d="M28 18h44l18 22-40 50-40-50z" />
          <path d="M10 40h80M38 18l-8 22 20 50 20-50-8-22" />
        </g>
      );
    default:
      return (
        <g {...common}>
          <circle cx="50" cy="50" r="14" />
          <path d="M50 12v12M50 76v12M12 50h12M76 50h12M23 23l9 9M68 68l9 9M23 77l9-9M68 32l9-9" />
        </g>
      );
  }
}

/** A zig-zag "trend" whose shape is seeded by the id. */
function trend(id: string, w: number, h: number, steps = 7): string {
  let seed = hash(id);
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
    const x = (w / steps) * i;
    const y = h * (0.3 + 0.5 * ((seed % 1000) / 1000));
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

function Grid({ id, w, h, step }: { id: string; w: number; h: number; step: number }) {
  return (
    <>
      <defs>
        <pattern id={id} width={step} height={step} patternUnits="userSpaceOnUse">
          <path d={`M${step} 0H0V${step}`} fill="none" stroke="#fff" strokeOpacity="0.05" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill={`url(#${id})`} />
    </>
  );
}

interface TileProps {
  id: string;
  kind: string;
  /** Text drawn on the art. Omit for a plain tile. */
  title?: string;
  className?: string;
}

export function Capsule({ id, kind, title, className = "" }: TileProps) {
  const hue = hueFor(id);
  const g = `t-${id.replace(/[^\w-]/g, "")}`;
  return (
    <div className={`capsule ${className}`} style={{ ["--tint" as string]: `hsl(${hue} 85% 62%)` }}>
      <svg viewBox="0 0 460 215" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <radialGradient id={`${g}-glow`} cx="0.8" cy="0.4" r="0.55">
            <stop offset="0" stopColor={`hsl(${hue} 85% 55%)`} stopOpacity="0.28" />
            <stop offset="1" stopColor={`hsl(${hue} 85% 55%)`} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="460" height="215" fill="#111113" />
        <Grid id={`${g}-grid`} w={460} h={215} step={23} />
        <rect width="460" height="215" fill={`url(#${g}-glow)`} />
        <path d={trend(id, 460, 215)} fill="none" stroke="var(--tint)" strokeOpacity="0.35" strokeWidth="2" />
        <g transform="translate(300 34) scale(1.45)" style={{ color: "var(--tint)" }}>
          <KindIcon kind={kind} />
        </g>
      </svg>
      {title && <span className="capsule-title">{title}</span>}
    </div>
  );
}

/** Wide header for a game: graph paper with a rising change line. */
export function Banner({ id, title, tag, children }: { id: string; title: string; tag?: React.ReactNode; children?: React.ReactNode }) {
  const g = `b-${id.replace(/[^\w-]/g, "")}`;
  const line = trend(id, 1000, 300, 12);
  return (
    <div className="banner">
      <svg viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={`${g}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${g}-fade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0b0b0c" stopOpacity="0.95" />
            <stop offset="0.6" stopColor="#0b0b0c" stopOpacity="0.2" />
            <stop offset="1" stopColor="#0b0b0c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="1000" height="300" fill="#0e0e10" />
        <Grid id={`${g}-grid`} w={1000} h={300} step={30} />
        <path d={`${line} L1000 300 L0 300 Z`} fill={`url(#${g}-area)`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        <rect width="1000" height="300" fill={`url(#${g}-fade)`} />
      </svg>
      <div className="banner-content">
        {tag}
        <h2 className="banner-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
