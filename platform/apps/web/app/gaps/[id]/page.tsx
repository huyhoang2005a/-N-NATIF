"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GapResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { GAP_SEVERITY_LABELS, GAP_STATUS_LABELS, gapSeverityBadgeClass, gapStatusBadgeClass } from "../../../lib/labels";
import { getAccessToken } from "../../../lib/session";
import { FormField } from "../../_components/FormField";
import { SiteHeader } from "../../_components/SiteHeader";

const GAP_STATUSES = Object.keys(GAP_STATUS_LABELS);
const RESOLUTION_STATUSES = ["RESOLVED", "ACCEPTED_RISK", "CLOSED"];

export default function GapDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const gapId = params.id;

  const [gap, setGap] = useState<GapResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({ title: "", description: "", category: "", ownerUserId: "", dueDate: "" });
  const [targetStatus, setTargetStatus] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  async function load() {
    const g = await authFetch<GapResponse>(`/gaps/${gapId}`);
    setGap(g);
    setEditForm({
      title: g.title,
      description: g.description,
      category: g.category ?? "",
      ownerUserId: g.ownerUserId ?? "",
      dueDate: g.dueDate ?? "",
    });
    if (!targetStatus) setTargetStatus(g.status);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    load().catch((err) => {
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setLoadError("Không tải được dữ liệu gap.");
    });
    // Intentionally depends only on gapId — `load` closes over state that would otherwise
    // cause a dependency-array footgun; router doesn't change across renders.
  }, [gapId]);

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setActionError(err instanceof ApiError ? describeErrorCode(err.code) : "Thao tác thất bại, vui lòng thử lại.");
    } finally {
      setBusyKey(null);
    }
  }

  function onSaveEdit() {
    return runAction("edit", async () => {
      await authFetch(`/gaps/${gapId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          category: editForm.category || undefined,
          ownerUserId: editForm.ownerUserId || undefined,
          dueDate: editForm.dueDate || undefined,
        }),
      });
      await load();
    });
  }

  function onTransition() {
    const needsNote = RESOLUTION_STATUSES.includes(targetStatus);
    if (needsNote && !resolutionNote.trim()) return Promise.resolve();
    return runAction("transition", async () => {
      await authFetch(`/gaps/${gapId}/transition`, {
        method: "POST",
        body: JSON.stringify({ toStatus: targetStatus, resolutionNote: resolutionNote.trim() || undefined }),
      });
      setResolutionNote("");
      await load();
    });
  }

  if (loadError) {
    return (
      <div className="shell">
        <SiteHeader />
        <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)" }}>
          <p className="alert alert-error" role="alert">
            {loadError}
          </p>
        </div>
      </div>
    );
  }

  if (!gap) {
    return (
      <div className="shell">
        <SiteHeader />
      </div>
    );
  }

  return (
    <div className="shell">
      <SiteHeader />
      <div className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-9)", maxWidth: 680 }}>
        <span className="eyebrow">Phase 4 · Gap</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
          <h1 style={{ fontSize: 30 }}>{gap.title}</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignItems: "flex-end" }}>
            <span className={gapSeverityBadgeClass(gap.severity)}>{GAP_SEVERITY_LABELS[gap.severity] ?? gap.severity}</span>
            <span className={gapStatusBadgeClass(gap.status)}>{GAP_STATUS_LABELS[gap.status] ?? gap.status}</span>
          </div>
        </div>
        <p style={{ marginTop: "var(--space-3)", fontSize: 14, color: "var(--ink-700)" }}>{gap.description}</p>
        {gap.resolutionNote && (
          <p style={{ marginTop: "var(--space-3)", fontSize: 13, color: "var(--ink-400)" }}>
            Ghi chú xử lý: {gap.resolutionNote}
          </p>
        )}

        {actionError && (
          <p className="alert alert-error" role="alert" style={{ marginTop: "var(--space-5)" }}>
            {actionError}
          </p>
        )}

        <div className="card" style={{ marginTop: "var(--space-6)" }}>
          <span className="eyebrow">Chỉnh sửa</span>
          <div className="form-stack" style={{ marginTop: "var(--space-4)" }}>
            <FormField label="Tiêu đề">
              <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </FormField>
            <FormField label="Mô tả">
              <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </FormField>
            <div className="field-row">
              <FormField label="Danh mục" optional>
                <input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
              </FormField>
              <FormField label="Người phụ trách" optional hint="UUID user">
                <input value={editForm.ownerUserId} onChange={(e) => setEditForm({ ...editForm, ownerUserId: e.target.value })} />
              </FormField>
              <FormField label="Hạn xử lý" optional>
                <input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
              </FormField>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busyKey === "edit" || !editForm.title || !editForm.description}
            onClick={onSaveEdit}
            style={{ marginTop: "var(--space-4)" }}
          >
            {busyKey === "edit" ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </div>

        <div className="card">
          <span className="eyebrow">Chuyển trạng thái</span>
          <div className="field-row" style={{ marginTop: "var(--space-4)" }}>
            <FormField label="Trạng thái đích">
              <select value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)}>
                {GAP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {GAP_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          {RESOLUTION_STATUSES.includes(targetStatus) && (
            <FormField label="Ghi chú xử lý (bắt buộc)" hint="Bắt buộc khi chuyển sang RESOLVED/ACCEPTED_RISK/CLOSED">
              <textarea rows={2} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} />
            </FormField>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              busyKey === "transition" || (RESOLUTION_STATUSES.includes(targetStatus) && !resolutionNote.trim())
            }
            onClick={onTransition}
            style={{ marginTop: "var(--space-4)" }}
          >
            {busyKey === "transition" ? "Đang chuyển…" : "Chuyển trạng thái"}
          </button>
        </div>
      </div>
    </div>
  );
}
