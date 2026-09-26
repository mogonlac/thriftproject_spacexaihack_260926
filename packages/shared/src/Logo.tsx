// Official Oxfam logo (Wikimedia Commons "Logo Oxfam 01.svg" — public-domain artwork,
// but the Oxfam name and logo are registered trademarks: demo use only, see
// packages/shared/assets/README.md). Inline SVG so it inherits the brand
// colour from theme.css and renders the same in both apps (no Tailwind needed).

const MARK = "m229.86 119.99c0 60.463-49.213 109.47-109.93 109.47-60.705 0-109.92-49.009-109.92-109.47 0-60.448 49.216-109.46 109.93-109.46 60.711 0 109.93 49.009 109.93 109.46m-88.362 17.015c13.023-7.1143 22.143-20.414 23.304-35.951a1.1203 1.1203 0 0 0-1.1298-1.1141h-20.062c-0.62136 0-1.0544 0.4927-1.1298 1.1172-1.6224 10.974-11.119 19.394-22.595 19.394-11.467 0-20.963-8.4198-22.595-19.394-0.0565-0.64961-0.50211-1.1141-1.1298-1.1141h-20.053a1.1235 1.1235 0 0 0-1.1235 1.1172c1.1517 15.534 10.281 28.84 23.295 35.951-13.645 7.4501-23.003 21.716-23.411 38.204 0 0.62136 0.50211 1.1235 1.1298 1.1235h19.94a1.1297 1.1297 0 0 0 1.1298-1.1235c0.58684-12.041 10.582-21.628 22.815-21.628 12.251 0 22.243 9.5872 22.827 21.628a1.1297 1.1297 0 0 0 1.1298 1.1235h19.946c0.62136 0 1.1235-0.50211 1.1235-1.1235-0.40797-16.491-9.7598-30.754-23.411-38.204m-65.356-41.562h20.059c0.62136 0 1.0607-0.48955 1.1235-1.1203 1.6319-10.968 11.128-19.388 22.595-19.388 11.473 0 20.973 8.4198 22.604 19.388 0.0753 0.61822 0.57429 1.1203 1.1925 1.1203h19.99c0.62136 0 1.1235-0.50211 1.1235-1.1172-1.726-23.197-21.167-41.477-44.907-41.477-23.734 0-43.175 18.28-44.901 41.477 0 0.61822 0.50211 1.1172 1.1235 1.1172";
const WORDMARK = "m328.7 94.65v38.537c0 11.401-8.925 24.823-28.14 24.873-19.218-0.0533-28.14-13.472-28.14-24.873v-38.537c0-11.392 8.925-24.811 28.143-24.864 19.215 0.0565 28.14 13.479 28.14 24.867zm-17.386 1.3369c0-6.5902-6.7785-8.8183-10.755-8.8183-3.9761 0-10.764 2.2281-10.764 8.8183v35.869c0 6.5902 6.7879 8.8183 10.764 8.8183 3.9761 0 10.755-2.2281 10.755-8.8183zm110.86 60.498v-33.554h26.662v-17.197h-26.54v-17.081h30.786v-17.301h-48.253v85.133m89.994-15.082h-22.626l-3.9761 15.082h-17.411l22.3-85.139h20.282l22.664 85.139h-17.332l-3.8976-15.082zm-18.358-16.695h14.021l-6.9448-26.788zm95.495-53.355-15.302 32.75-15.509-32.753h-17.803v85.133h16.984v-48.429l10.921 22.642h10.846l10.921-22.57v48.359h16.987v-85.139m-216.08 42.513 22.134-42.51h-20.084l-12.107 24.785-12.113-24.792h-20.084l22.134 42.513-22.25 42.626h20.31l12-24.729 11.997 24.729h20.31";

/** Horizontal lockup: roundel + OXFAM wordmark. `size` is the logo's height in px. */
export function Logo({ size = 48, withTagline = false }: { size?: number; withTagline?: boolean }) {
  return (
    <div
      role="img"
      aria-label="Oxfam"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, userSelect: "none", flexShrink: 0 }}
    >
      <svg viewBox="9 9 582 222" height={size} width={(size * 582) / 222} aria-hidden style={{ display: "block", flexShrink: 0 }}>
        <path d={MARK} fill="var(--accent)" />
        <path d={WORDMARK} fill="var(--accent)" />
      </svg>
      {withTagline && (
        <span className="label" style={{ color: "var(--muted)", fontSize: 14, letterSpacing: "0.2em" }}>
          Charity shop · Pre-loved
        </span>
      )}
    </div>
  );
}

/** Just the roundel, for tight spaces. `size` is its diameter in px. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="9 9 222 222" width={size} height={size} role="img" aria-label="Oxfam" style={{ display: "block", flexShrink: 0 }}>
      <path d={MARK} fill="var(--accent)" />
    </svg>
  );
}
