import Link from "next/link";

/** Author/organization name shown as a link to their public profile — shared by every
 * card and public-profile page that references an author or org, so the "click name to
 * see who they are" pattern never gets reimplemented ad hoc (`06_phase5_full_design.md`
 * §3 item 28). Renders plain text (no link) when a slug isn't available yet. */
export function AuthorOrgByline({
  authorName,
  authorSlug,
  organizationName,
  organizationSlug,
}: {
  authorName?: string | null;
  authorSlug?: string | null;
  organizationName?: string | null;
  organizationSlug?: string | null;
}) {
  const parts: React.ReactNode[] = [];
  if (authorName) {
    parts.push(
      authorSlug ? (
        <Link key="author" href={`/authors/${authorSlug}`} style={{ color: "var(--uikit-indigo-700)" }}>
          {authorName}
        </Link>
      ) : (
        <span key="author">{authorName}</span>
      ),
    );
  }
  if (organizationName) {
    parts.push(
      organizationSlug ? (
        <Link key="org" href={`/organizations/${organizationSlug}`} style={{ color: "var(--uikit-indigo-700)" }}>
          {organizationName}
        </Link>
      ) : (
        <span key="org">{organizationName}</span>
      ),
    );
  }
  if (parts.length === 0) return null;

  return (
    <p style={{ fontSize: 12, color: "var(--uikit-slate-500)" }}>
      {parts.reduce<React.ReactNode[]>((acc, part, i) => (i === 0 ? [part] : [...acc, " · ", part]), [])}
    </p>
  );
}
