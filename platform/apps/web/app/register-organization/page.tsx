"use client";

import { useState } from "react";
import type { OrganizationResponse, RegisterOrganizationRequest } from "@r2m/contracts";
import { ApiError, apiFetch } from "../../lib/api-client";

const initialForm: RegisterOrganizationRequest = {
  organizationName: "",
  organizationType: "RESEARCH_UNIT",
  ownerEmail: "",
  ownerPassword: "",
  ownerDisplayName: "",
};

export default function RegisterOrganizationPage() {
  const [form, setForm] = useState<RegisterOrganizationRequest>(initialForm);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [organization, setOrganization] = useState<OrganizationResponse | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage(null);
    try {
      const org = await apiFetch<OrganizationResponse>("/organizations/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setOrganization(org);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof ApiError ? error.message : "Đăng ký thất bại.");
    }
  }

  if (status === "success" && organization) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px" }}>
        <h1>Đăng ký thành công</h1>
        <p>
          Tổ chức <strong>{organization.name}</strong> đã được tạo với trạng thái{" "}
          <strong>{organization.status}</strong>. Vui lòng chờ platform reviewer xác minh trước khi có
          thể mời thành viên.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px" }}>
      <h1>Đăng ký tổ chức</h1>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Tên tổ chức
          <input
            required
            value={form.organizationName}
            onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
          />
        </label>
        <label>
          Loại tổ chức
          <select
            value={form.organizationType}
            onChange={(e) =>
              setForm({ ...form, organizationType: e.target.value as RegisterOrganizationRequest["organizationType"] })
            }
          >
            <option value="RESEARCH_UNIT">Research Unit</option>
            <option value="ENTERPRISE">Enterprise</option>
            <option value="GOVERNMENT">Government</option>
            <option value="SUPPORT_ORGANIZATION">Support Organization</option>
          </select>
        </label>
        <label>
          Website (tuỳ chọn)
          <input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </label>
        <label>
          Mã số thuế (tuỳ chọn)
          <input value={form.taxCode ?? ""} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} />
        </label>
        <label>
          Họ tên chủ sở hữu (owner)
          <input
            required
            value={form.ownerDisplayName}
            onChange={(e) => setForm({ ...form, ownerDisplayName: e.target.value })}
          />
        </label>
        <label>
          Email owner
          <input
            type="email"
            required
            value={form.ownerEmail}
            onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
          />
        </label>
        <label>
          Mật khẩu owner
          <input
            type="password"
            required
            minLength={8}
            value={form.ownerPassword}
            onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
          />
        </label>
        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Đang đăng ký..." : "Đăng ký tổ chức"}
        </button>
      </form>
      {status === "error" && <p style={{ color: "crimson" }}>{errorMessage}</p>}
    </main>
  );
}
