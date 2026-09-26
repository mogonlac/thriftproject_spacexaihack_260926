// Thin-line icons in the Zara style (1.25px strokes).
type P = { size?: number; className?: string };
const base = (size: number) => ({ width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.25, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export const ArrowLeft = ({ size = 32, className }: P) => (
  <svg viewBox="0 0 32 32" {...base(size)} className={className} aria-hidden><path d="M28 16H5M13 7l-9 9 9 9" /></svg>
);
export const Close = ({ size = 32, className }: P) => (
  <svg viewBox="0 0 32 32" {...base(size)} className={className} aria-hidden><path d="M5 5l22 22M27 5L5 27" /></svg>
);
export const Plus = ({ size = 20, className }: P) => (
  <svg viewBox="0 0 20 20" {...base(size)} className={className} aria-hidden><path d="M10 3v14M3 10h14" /></svg>
);
export const Check = ({ size = 20, className }: P) => (
  <svg viewBox="0 0 20 20" {...base(size)} className={className} aria-hidden><path d="M4 10.5l4 4 8-9" /></svg>
);
export const Search = ({ size = 24, className }: P) => (
  <svg viewBox="0 0 24 24" {...base(size)} className={className} aria-hidden><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></svg>
);
export const Chat = ({ size = 32, className }: P) => (
  <svg viewBox="0 0 32 32" {...base(size)} className={className} aria-hidden>
    <path d="M5 7h22v15H14l-6 5v-5H5z" />
  </svg>
);
export const Bag = ({ size = 32, count, className }: P & { count?: number }) => (
  <svg viewBox="0 0 32 32" {...base(size)} className={className} aria-hidden>
    <path d="M6 10h20v18H6z" />
    <path d="M11 10V8a5 5 0 0 1 10 0v2" />
    {count !== undefined && (
      <text x="16" y="23.5" textAnchor="middle" fontSize="10" stroke="none" fill="currentColor" style={{ fontFamily: "var(--font-archivo)" }}>
        {count}
      </text>
    )}
  </svg>
);
export const Filters = ({ size = 22, className }: P) => (
  <svg viewBox="0 0 24 24" {...base(size)} className={className} aria-hidden>
    <path d="M3 7h12M19 7h2M3 17h4M11 17h10" /><circle cx="17" cy="7" r="2" /><circle cx="9" cy="17" r="2" />
  </svg>
);
export const Pin = ({ size = 20, className }: P) => (
  <svg viewBox="0 0 20 20" {...base(size)} className={className} aria-hidden>
    <path d="M10 18s6-5.2 6-10a6 6 0 0 0-12 0c0 4.8 6 10 6 10z" /><circle cx="10" cy="8" r="2" />
  </svg>
);
export const Send = ({ size = 22, className }: P) => (
  <svg viewBox="0 0 24 24" {...base(size)} className={className} aria-hidden><path d="M4 12h15M13 6l6 6-6 6" /></svg>
);
