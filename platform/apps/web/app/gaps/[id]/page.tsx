"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Save, ArrowRightCircle } from "lucide-react";
import type { GapResponse, MeResponse, OrganizationResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../../lib/api-client";
import { describeErrorCode } from "../../../lib/error-messages";
import { GAP_SEVERITY_LABELS, GAP_STATUS_LABELS, PLATFORM_ROLE_LABELS } from "../../../lib/labels";
import { navForPersona, personaOf } from "../../../lib/nav";
import { getAccessToken } from "../../../lib/session";
import { toneOf, GAP_SEVERITY_TONE, GAP_STATUS_TONE } from "../../../lib/tone";
import { BackLink, Card, PrimaryButton, SelectField, Shell, StatusPill, TextField } from "../../../components/ui";

const GAP_STATUSES = Object.keys(GAP_STATUS_LABELS);
const RESOLUTION_STATUSES = ["RESOLVED", "ACCEPTED_RISK", "CLOSED"];

export default function GapDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const gapId = params.id;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationResponse[] | null>(null);
  const [gap, setGap] = useState<GapResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({ title: "", description: "", category: "", ownerUserId: "", dueDate: "" });
  const [targetStatus, setTargetStatus] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  async function load() {
    const [meResponse, myOrgs, g] = await Promise.all([
      authFetch<MeResponse>("/me"),
      authFetch<OrganizationResponse[]>("/organizations"),
      authFetch<GapResponse>(`/gaps/${gapId}`),
    ]);
    setMe(meResponse);
    setOrganizations(myOrgs);
    setGap(g);
    setEditForm({
      title: g.title,
      description: g.description,
      category: g.category ?? "",
      ownerUserId: g.ownerUserId ?? "",
      dueDate: g.dueDate ?? "",
    });
    setTargetStatus((current) => current || g.status);
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

  if (!me || !organizations) {
    if (loadError) {
      return (
        <div className="uikit-main" style={{ maxWidth: 680, margin: "0 auto" }}>
          <p className="uikit-alert-error" role="alert">
            {loadError}
          </p>
        </div>
      );
    }
    return null;
  }

  const roleLabel = PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole;
  const nav = navForPersona(personaOf(me, organizations), me.platformRole === "PLATFORM_ADMIN");

  if (loadError) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
        <p className="uikit-alert-error" role="alert">
          {loadError}
        </p>
      </Shell>
    );
  }

  if (!gap) {
    return (
      <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
        {null}
      </Shell>
    );
  }

  return (
    <Shell brandLabel="R2M" me={me} roleLabel={roleLabel} nav={nav}>
      <div className="uikit-stack" style={{ maxWidth: 640 }}>
        <BackLink href="/technology-cases">Quay lại danh sách case</BackLink>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <h1 style={{ fontSize: 22 }}>{gap.title}</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <StatusPill tone={toneOf(GAP_SEVERITY_TONE, gap.severity)}>
              {GAP_SEVERITY_LABELS[gap.severity] ?? gap.severity}
            </StatusPill>
            <StatusPill tone={toneOf(GAP_STATUS_TONE, gap.status)}>
              {GAP_STATUS_LABELS[gap.status] ?? gap.status}
            </StatusPill>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "var(--uikit-slate-700)" }}>{gap.description}</p>
        {gap.resolutionNote && (
          <p style={{ fontSize: 13, color: "var(--uikit-slate-500)" }}>Ghi chú xử lý: {gap.resolutionNote}</p>
        )}

        {actionError && (
          <p className="uikit-alert-error" role="alert">
            {actionError}
          </p>
        )}

        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-4)" }}>Chỉnh sửa</h2>
          <div className="uikit-stack">
            <TextField label="Tiêu đề" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            <TextField
              label="Mô tả"
              as="textarea"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
            <TextField label="Danh mục" optional value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
            <TextField
              label="Người phụ trách"
              optional
              hint="UUID user"
              value={editForm.ownerUserId}
              onChange={(e) => setEditForm({ ...editForm, ownerUserId: e.target.value })}
            />
            <TextField label="Hạn xử lý" optional type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
          </div>
          <PrimaryButton
            icon={Save}
            disabled={busyKey === "edit" || !editForm.title || !editForm.description}
            onClick={onSaveEdit}
            style={{ marginTop: "var(--space-4)" }}
          >
            {busyKey === "edit" ? "Đang lưu…" : "Lưu thay đổi"}
          </PrimaryButton>
        </Card>

        <Card>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: "var(--space-4)" }}>Chuyển trạng thái</h2>
          <SelectField
            label="Trạng thái đích"
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value)}
            options={GAP_STATUSES.map((s) => ({ value: s, label: GAP_STATUS_LABELS[s] ?? s }))}
          />
          {RESOLUTION_STATUSES.includes(targetStatus) && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <TextField
                label="Ghi chú xử lý"
                required
                as="textarea"
                hint="Bắt buộc khi chuyển sang Đã giải quyết/Chấp nhận rủi ro/Đã đóng"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
            </div>
          )}
          <PrimaryButton
            icon={ArrowRightCircle}
            disabled={busyKey === "transition" || (RESOLUTION_STATUSES.includes(targetStatus) && !resolutionNote.trim())}
            onClick={onTransition}
            style={{ marginTop: "var(--space-4)" }}
          >
            {busyKey === "transition" ? "Đang chuyển…" : "Chuyển trạng thái"}
          </PrimaryButton>
        </Card>
      </div>
    </Shell>
  );
}
