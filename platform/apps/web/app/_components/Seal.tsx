const RING_TEXT = "R2M · SỔ ĐĂNG KÝ · R2M · SỔ ĐĂNG KÝ · ";

/** The registry seal: a rotating rim of the wordmark around a hairline ring.
 * `verified` swaps the rim/check to the brass accent — used once a
 * verification has actually happened, never decoratively. */
export function Seal({
  verified = false,
  size = 132,
  className,
}: {
  verified?: boolean;
  size?: number;
  className?: string;
}) {
  const ringColor = verified ? "var(--seal-gold)" : "var(--ink-900)";
  const id = verified ? "seal-ring-verified" : "seal-ring-mark";

  return (
    <svg
      viewBox="0 0 132 132"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={verified ? "Con dấu: đã xác minh" : "Biểu tượng R2M Registry"}
    >
      <path id={id} fill="none" d="M 66,66 m -52,0 a 52,52 0 1,1 104,0 a 52,52 0 1,1 -104,0" />
      <circle cx="66" cy="66" r="52" fill="none" stroke={ringColor} strokeWidth="1" opacity="0.35" />
      <circle cx="66" cy="66" r="41" fill="none" stroke={ringColor} strokeWidth="1" strokeDasharray="1 5" />
      <text fontFamily="var(--font-mono)" fontSize="8.4" letterSpacing="2.4" fill={ringColor}>
        <textPath href={`#${id}`} startOffset="0%">
          {RING_TEXT}
        </textPath>
      </text>
      {verified ? (
        <path
          d="M50 67 L61 78 L84 53"
          fill="none"
          stroke="var(--seal-gold)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <text
          x="66"
          y="73"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontStyle="italic"
          fontWeight="600"
          fontSize="26"
          fill="var(--ink-900)"
        >
          R2M
        </text>
      )}
    </svg>
  );
}
