/** Fired by `Shell` when the user clicks a sidebar nav item that's already the active
 * route (no navigation happens, since Next.js no-ops a `<Link>` to the current URL) — the
 * page itself must listen and refetch, same "tap the already-open tab to refresh" pattern
 * as Facebook/Instagram/Reddit's bottom-nav Home icon. Not every page needs to care; only
 * ones showing a feed-like, can-go-stale list (e.g. `/activity-feed`) listen for it. */
export const REFRESH_ACTIVE_NAV_EVENT = "r2m:refresh-active-nav";
