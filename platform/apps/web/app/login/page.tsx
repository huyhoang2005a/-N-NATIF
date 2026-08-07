"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LoginRequest, TokenResponse } from "@r2m/contracts";
import { ApiError, apiFetch } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";
import { saveTokens } from "../../lib/session";
import { BrandMark, PrimaryButton, TextField } from "../../components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginRequest>({ email: "", password: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage(null);
    try {
      const tokens = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(form),
      });
      saveTokens(tokens);
      router.push("/dashboard");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof ApiError ? describeErrorCode(error.code) : "Đăng nhập thất bại.");
    }
  }

  return (
    <div className="uikit-shell" style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "var(--space-6) var(--space-5)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "var(--space-6)" }}>
          <BrandMark size="lg" />
          <h1 style={{ fontSize: 22, marginTop: "var(--space-4)" }}>Đăng nhập R2M</h1>
          <p style={{ marginTop: "var(--space-2)", fontSize: 14, color: "var(--uikit-slate-500)", textAlign: "center" }}>
            Dùng tài khoản đã đăng ký để truy cập không gian làm việc của bạn.
          </p>
        </div>

        <div className="uikit-card">
          <form onSubmit={onSubmit} className="uikit-stack">
            <TextField
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label="Mật khẩu"
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            {status === "error" && errorMessage && (
              <p className="uikit-alert-error" role="alert">
                {errorMessage}
              </p>
            )}

            <PrimaryButton type="submit" full disabled={status === "loading"}>
              {status === "loading" ? "Đang đăng nhập…" : "Đăng nhập"}
            </PrimaryButton>
          </form>
        </div>

        <p style={{ marginTop: "var(--space-5)", fontSize: 13, color: "var(--uikit-slate-500)", textAlign: "center" }}>
          Chưa có tổ chức?{" "}
          <Link href="/register-organization" style={{ color: "var(--uikit-indigo-700)", fontWeight: 500 }}>
            Đăng ký tổ chức
          </Link>
        </p>
      </div>
    </div>
  );
}
