"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LoginRequest, TokenResponse } from "@r2m/contracts";
import { ApiError, apiFetch } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";
import { saveTokens } from "../../lib/session";
import { FormField } from "../_components/FormField";
import { SiteHeader } from "../_components/SiteHeader";

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
    <div className="shell">
      <SiteHeader />

      <div className="shell__center">
        <div className="dossier" style={{ width: "100%", maxWidth: 420 }}>
          <div className="dossier__stub">
            <span>Truy cập sổ đăng ký</span>
            <span>Bảo mật</span>
          </div>
          <div className="dossier__perforation" />
          <div className="dossier__body">
            <h1 style={{ fontSize: 26 }}>Đăng nhập</h1>
            <p style={{ marginTop: "var(--space-2)", color: "var(--ink-700)", fontSize: 14 }}>
              Dùng tài khoản đã được xác minh để truy cập hồ sơ tổ chức của bạn.
            </p>

            <form onSubmit={onSubmit} className="form-stack" style={{ marginTop: "var(--space-5)" }}>
              <FormField label="Email">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormField>
              <FormField label="Mật khẩu">
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </FormField>

              {status === "error" && errorMessage && (
                <p className="alert alert-error" role="alert">
                  {errorMessage}
                </p>
              )}

              <button type="submit" className="btn btn-primary btn-block" disabled={status === "loading"}>
                {status === "loading" ? "Đang đăng nhập…" : "Đăng nhập"}
              </button>
            </form>

            <p style={{ marginTop: "var(--space-5)", fontSize: 13, color: "var(--ink-400)" }}>
              Chưa có tổ chức?{" "}
              <Link href="/register-organization" className="nav-link" style={{ display: "inline" }}>
                Đăng ký tổ chức
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
