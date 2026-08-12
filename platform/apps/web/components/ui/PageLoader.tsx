import { BrandMark } from "./BrandMark";

/** Spins the R2M logomark while a page's initial `useEffect` fetch is in flight —
 * used in place of every `if (!x) return null;` data-loading guard so the app
 * never flashes a blank white screen.
 * `inline` = smaller, fixed-height variant for use *inside* an already-rendered
 * `Shell` (nav/topbar visible, only the content area is still loading) — the
 * default full-viewport variant is for the outer gate before `Shell` itself has
 * enough data (`me`/`organizations`) to render at all. */
export function PageLoader({ inline = false }: { inline?: boolean }) {
  return (
    <div className={inline ? "uikit-page-loader uikit-page-loader--inline" : "uikit-page-loader"}>
      <div className="uikit-page-loader__mark">
        <BrandMark size="lg" />
      </div>
    </div>
  );
}
