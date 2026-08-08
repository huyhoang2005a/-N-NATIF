/** Locked design token (indigo-700/indigo-50) — shared by every AI-recommendation
 * surface (FOCUSED "Gợi ý AI" tab, FEED "Gợi ý công nghệ" page) so match-score styling
 * never drifts between the two. */
export function MatchScoreBadge({ score }: { score: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: "var(--uikit-indigo-50)",
        color: "var(--uikit-indigo-700)",
      }}
    >
      {Math.round(score * 100)}% phù hợp
    </span>
  );
}
