// Generated "capsule" artwork. Game data rarely comes with images, so every
// entity gets a deterministic banner built from its id: a colour pulled from a
// store-like palette, diagonal light streaks, and a large icon for its kind.

const PALETTE = [
  [205, 55], // steel blue
  [190, 50], // teal
  [220, 45], // indigo
  [18, 60], // ember
  [35, 55], // amber
  [150, 35], // moss
  [265, 35], // violet
  [0, 50], // crimson
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function paletteFor(id: string) {
  const [hue, sat] = PALETTE[hash(id) % PALETTE.length];
  return { hue, sat };
}

function KindIcon({ kind }: { kind: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
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
          <circle cx="50" cy="50" r="4" fill="currentColor" />
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

interface CapsuleProps {
  id: string;
  kind: string;
  /** Text drawn on the art, like a game logo. Omit for a plain capsule. */
  title?: string;
  className?: string;
}

/** A 460×215 (Steam header ratio) banner for an entity. */
export function Capsule({ id, kind, title, className = "" }: CapsuleProps) {
  const { hue, sat } = paletteFor(id);
  const g = `cap-${id}`;
  return (
    <div className={`capsule ${className}`} style={{ color: `hsl(${hue} ${sat}% 78%)` }}>
      <svg viewBox="0 0 460 215" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={`${g}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`hsl(${hue} ${sat}% 30%)`} />
            <stop offset="0.6" stopColor={`hsl(${hue + 20} ${sat}% 14%)`} />
            <stop offset="1" stopColor={`hsl(${hue + 30} ${sat}% 8%)`} />
          </linearGradient>
          <radialGradient id={`${g}-glow`} cx="0.78" cy="0.35" r="0.6">
            <stop offset="0" stopColor={`hsl(${hue} ${sat + 20}% 60%)`} stopOpacity="0.55" />
            <stop offset="1" stopColor={`hsl(${hue} ${sat}% 40%)`} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="460" height="215" fill={`url(#${g}-bg)`} />
        <rect width="460" height="215" fill={`url(#${g}-glow)`} />
        <g opacity="0.08" fill="#fff">
          <path d="M250 0h40L170 215h-40z" />
          <path d="M320 0h14L214 215h-14z" />
          <path d="M380 0h70L330 215h-70z" />
        </g>
        <g transform="translate(290 28) scale(1.6)" opacity="0.85">
          <KindIcon kind={kind} />
        </g>
      </svg>
      {title && <span className="capsule-title">{title}</span>}
    </div>
  );
}

/** Wide hero banner for a game or a patch. */
export function Banner({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  const { hue, sat } = paletteFor(id);
  const g = `ban-${id.replace(/[^\w-]/g, "")}`;
  return (
    <div className="banner">
      <svg viewBox="0 0 940 350" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id={`${g}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`hsl(${hue} ${sat}% 26%)`} />
            <stop offset="0.55" stopColor={`hsl(${hue + 15} ${sat}% 12%)`} />
            <stop offset="1" stopColor="#0e141c" />
          </linearGradient>
          <radialGradient id={`${g}-sun`} cx="0.8" cy="0.2" r="0.7">
            <stop offset="0" stopColor={`hsl(${hue - 10} 90% 65%)`} stopOpacity="0.5" />
            <stop offset="1" stopColor={`hsl(${hue} 60% 40%)`} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${g}-fade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.45" stopColor="#0e141c" stopOpacity="0" />
            <stop offset="1" stopColor="#0e141c" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect width="940" height="350" fill={`url(#${g}-bg)`} />
        <rect width="940" height="350" fill={`url(#${g}-sun)`} />
        {/* A skyline of arena towers. */}
        <g fill={`hsl(${hue + 10} ${sat}% 9%)`} opacity="0.9">
          <path d="M0 290h60v-70h30v40h40v-90h26v60h50v-40h36v110h44v-150h30v80h40v-50h34v70h46v-120h24v60h56v-30h40v70h46v-100h30v60h40v-40h36v80h52v-60h30v140H0z" />
        </g>
        <g opacity="0.07" fill="#fff">
          <path d="M520 0h80L380 350h-80z" />
          <path d="M650 0h24L454 350h-24z" />
          <path d="M760 0h120L660 350H540z" />
        </g>
        <rect width="940" height="350" fill={`url(#${g}-fade)`} />
      </svg>
      <div className="banner-content">
        <h2 className="banner-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
