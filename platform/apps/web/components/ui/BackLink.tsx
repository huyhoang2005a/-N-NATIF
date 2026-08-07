import type { ReactNode } from "react";
import Link from "next/link";

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="uikit-backlink">
      ← {children}
    </Link>
  );
}
