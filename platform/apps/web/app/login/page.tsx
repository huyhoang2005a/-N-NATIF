"use client";

import { useState } from "react";
import type { LoginRequest, TokenResponse } from "@r2m/contracts";
import { ApiError, apiFetch } from "../../lib/api-client";

export default function LoginPage() {
  const [form, setForm] = useState<LoginRequest>({ email: "", password: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
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
      window.localStorage.setItem("r2m.accessToken", tokens.accessToken);
      window.localStorage.setItem("r2m.refreshToken", tokens.refreshToken);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof ApiError ? error.message : "Đăng nhập thất bại.");
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: "80px auto", padding: "0 16px" }}>
      <h1>Đăng nhập</h1>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
      {status === "success" && <p>Đăng nhập thành công.</p>}
      {status === "error" && <p style={{ color: "crimson" }}>{errorMessage}</p>}
    </main>
  );
}
