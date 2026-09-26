// Placeholder charity-shop mark. Swap for the official logo file when available
// (e.g. <img src="/brand/logo.svg" />) — nothing else depends on this markup.
export function Logo({ size = 48, withTagline = false }: { size?: number; withTagline?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 select-none" aria-label="Oxfam">
      <div className="flex items-center gap-[0.18em]" style={{ fontSize: size }}>
        <svg viewBox="0 0 40 40" width="1em" height="1em" aria-hidden>
          <circle cx="20" cy="20" r="19" fill="var(--color-accent)" />
          <path d="M12 12 L28 28 M28 12 L12 28" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
        </svg>
        <span className="display text-accent" style={{ fontStretch: "75%", letterSpacing: "0.01em" }}>
          Oxfam
        </span>
      </div>
      {withTagline && <span className="label text-muted text-sm tracking-[0.2em]">Charity shop · Pre-loved</span>}
    </div>
  );
}
