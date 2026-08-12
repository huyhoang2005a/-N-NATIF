"use client";

import { useRouter } from "next/navigation";

/** Same visual as `BackLink`, but navigates via browser history (`router.back()`)
 * instead of a fixed `href` — for pages reachable from many different referrers
 * (public author/org profiles), where no single "parent" page exists to link to. */
export function BackButton({ fallbackHref = "/dashboard" }: { fallbackHref?: string }) {
  const router = useRouter();

  function onClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button type="button" onClick={onClick} className="uikit-backlink" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
      ← Quay lại
    </button>
  );
}
