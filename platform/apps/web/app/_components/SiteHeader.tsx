"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeResponse } from "@r2m/contracts";
import { apiFetch, authFetch } from "../../lib/api-client";
import { clearTokens, getAccessToken } from "../../lib/session";

type SessionState = "loading" | "guest" | { me: MeResponse };

export function SiteHeader() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>("loading");

  useEffect(() => {
    if (!getAccessToken()) {
      setSession("guest");
      return;
    }
    authFetch<MeResponse>("/me")
      .then((me) => setSession({ me }))
      .catch(() => {
        clearTokens();
        setSession("guest");
      });
  }, []);

  async function onLogout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // logout is a no-op server-side (stateless JWT) — clear the local session regardless.
    }
    clearTokens();
    setSession("guest");
    router.push("/");
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="wordmark">
          <span className="wordmark__mark">R2M</span>
          <span className="wordmark__tag">Nghiên cứu → Thị trường</span>
        </Link>

        {session === "loading" ? null : session === "guest" ? (
          <nav className="site-header__nav">
            <Link href="/login" className="nav-link">
              Đăng nhập
            </Link>
            <Link href="/register-organization" className="btn btn-ghost">
              Đăng ký tổ chức
            </Link>
          </nav>
        ) : (
          <nav className="site-header__nav">
            <span className="site-header__user">{session.me.displayName}</span>
            <Link href="/dashboard" className="nav-link">
              Bảng điều khiển
            </Link>
            {session.me.platformRole !== "USER" && (
              <Link href="/platform/organization-verifications" className="nav-link">
                Xét duyệt tổ chức
              </Link>
            )}
            <button type="button" className="site-header__logout" onClick={onLogout}>
              Đăng xuất
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
