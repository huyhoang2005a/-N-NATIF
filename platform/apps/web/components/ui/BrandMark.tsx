/** Logomark: three ascending bars (growth/progress) on a flat two-tone indigo
 * gradient badge — restrained, geometric, no illustrative/decorative elements.
 * Inline SVG so it stays crisp at every size. `id` is namespaced with `size` so
 * two instances on the same page (sidebar + login card) never collide. */
export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const gradientId = `r2m-brand-gradient-${size}`;
  return (
    <div className={`uikit-brand uikit-brand--${size}`}>
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="28" x2="28" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#3730a3" />
            <stop offset="1" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <rect width="28" height="28" rx="7" fill={`url(#${gradientId})`} />
        <g stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round">
          <path d="M8 20 V16" />
          <path d="M14 20 V11" />
          <path d="M20 20 V7" />
        </g>
      </svg>
    </div>
  );
}
