// Placeholder charity-shop mark, shared by the storefront and scanner.
// Swap for the official logo file when available (e.g. <img src="/brand/logo.svg" />)
// — nothing else depends on this markup. Styled inline (plus the shared .display/.label
// classes from theme.css) so it renders the same with or without Tailwind.
export function Logo({ size = 48, withTagline = false }: { size?: number; withTagline?: boolean }) {
  return (
    <div
      aria-label="Oxfam"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, userSelect: "none" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.18em", fontSize: size }}>
        <svg viewBox="0 0 40 40" width="1em" height="1em" aria-hidden>
          <circle cx="20" cy="20" r="19" fill="var(--accent)" />
          <path d="M12 12 L28 28 M28 12 L12 28" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
        </svg>
        <span className="display" style={{ color: "var(--accent)", fontStretch: "75%", letterSpacing: "0.01em" }}>
          Oxfam
        </span>
      </div>
      {withTagline && (
        <span className="label" style={{ color: "var(--muted)", fontSize: 14, letterSpacing: "0.2em" }}>
          Charity shop · Pre-loved
        </span>
      )}
    </div>
  );
}
