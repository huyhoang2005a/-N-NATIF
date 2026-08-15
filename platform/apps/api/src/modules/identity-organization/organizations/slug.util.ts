/** Deterministic slug derivation from an organization name (ASCII-fold + kebab-case). */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

/** Free/consumer webmail providers — never a signal of organizational identity, so the
 * domain-uniqueness check in `OrganizationsService.register()` must not treat two
 * different real organizations whose owners both happen to use, say, Gmail as the same
 * organization. Explicit user-approved fix (2026-08-15): registering a second org with an
 * owner email on one of these domains no longer gets blocked with
 * `ORG_DOMAIN_ALREADY_REGISTERED`, and no `organization_domain` row is created for it
 * (that table has a DB-level UNIQUE constraint on `domain` — a second org "owning" e.g.
 * gmail.com would violate it). Deliberately a fixed list, not a heuristic (e.g. "few
 * chars", "well-known TLD") — those produce false positives on legitimate small-company
 * domains; a maintained list is the only approach that doesn't misfire either direction. */
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "mail.com",
  // Phổ biến ở Việt Nam
  "vnn.vn",
  "yahoo.com.vn",
]);

export function isPublicEmailDomain(domain: string): boolean {
  return PUBLIC_EMAIL_DOMAINS.has(domain.toLowerCase());
}
