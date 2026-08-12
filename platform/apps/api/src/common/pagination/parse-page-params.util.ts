const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

export function parsePageLimit(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_PAGE_LIMIT;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_LIMIT;
  return Math.min(parsed, MAX_PAGE_LIMIT);
}

export function parsePageOffset(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return !Number.isFinite(parsed) || parsed < 0 ? 0 : parsed;
}
