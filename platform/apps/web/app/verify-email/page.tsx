"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EmailVerificationStatusResponse } from "@r2m/contracts";
import { ApiError, apiFetch } from "../../lib/api-client";
import { BrandMark, PrimaryButtonLink } from "../../components/ui";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}

type Outcome = "pending" | "success" | "invalid" | "expired" | "missing";

function VerifyEmailPageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [outcome, setOutcome] = useState<Outcome>("pending");
  // React StrictMode (dev) runs effects twice, and the token is one-time-use server-side —
  // a second call would always look "invalid" even though the first just succeeded. Guard
  // against calling confirm more than once per mount.
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!token) {
      setOutcome("missing");
      return;
    }

    apiFetch<EmailVerificationStatusResponse>("/email-verifications/confirm", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => setOutcome("success"))
      .catch((err) => {
        if (err instanceof ApiError && err.code === "AUTH_EMAIL_VERIFICATION_TOKEN_EXPIRED") {
          setOutcome("expired");
          return;
        }
        setOutcome("invalid");
      });
  }, [token]);

  return (
    <div className="uikit-shell" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "var(--space-6) var(--space-5)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "var(--space-6)" }}>
          <BrandMark size="lg" />
          <h1 style={{ fontSize: 22, marginTop: "var(--space-4)", textAlign: "center" }}>Xác thực email</h1>
        </div>

        <div className="uikit-card" style={{ textAlign: "center" }}>
          {outcome === "pending" && <p style={{ fontSize: 14, color: "var(--uikit-slate-500)" }}>Đang xác thực…</p>}

          {outcome === "success" && (
            <>
              <p style={{ fontSize: 14 }}>Email của bạn đã được xác thực thành công.</p>
              <div style={{ marginTop: "var(--space-4)" }}>
                <PrimaryButtonLink href="/login" full>
                  Đăng nhập để tiếp tục
                </PrimaryButtonLink>
              </div>
            </>
          )}

          {outcome === "missing" && (
            <p className="uikit-alert-error" role="alert">
              Thiếu mã xác thực trong liên kết. Vui lòng dùng đúng liên kết trong email.
            </p>
          )}

          {outcome === "invalid" && (
            <>
              <p className="uikit-alert-error" role="alert">
                Liên kết này không hợp lệ hoặc đã được sử dụng. Nếu bạn vừa xác thực thành công
                trước đó, email của bạn đã được xác thực — hãy đăng nhập để tiếp tục.
              </p>
              <div style={{ marginTop: "var(--space-4)" }}>
                <PrimaryButtonLink href="/login" full>
                  Đăng nhập
                </PrimaryButtonLink>
              </div>
            </>
          )}

          {outcome === "expired" && (
            <>
              <p className="uikit-alert-error" role="alert">
                Liên kết xác thực đã hết hạn. Đăng nhập rồi vào trang Hồ sơ để gửi lại email xác
                thực.
              </p>
              <div style={{ marginTop: "var(--space-4)" }}>
                <PrimaryButtonLink href="/login" full>
                  Đăng nhập
                </PrimaryButtonLink>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
