"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MeResponse, OrganizationResponse } from "@r2m/contracts";
import { RegistryStepper, REGISTRY_STEPS } from "./_components/RegistryStepper";
import { Reveal } from "./_components/Reveal";
import { Seal } from "./_components/Seal";
import { SiteHeader } from "./_components/SiteHeader";
import { authFetch } from "../lib/api-client";
import { ORG_STATUS_LABELS, ORG_TYPE_LABELS, orgStatusBadgeClass, PLATFORM_ROLE_LABELS } from "../lib/labels";
import { getAccessToken } from "../lib/session";

type AuthedSession = { me: MeResponse; organizations: OrganizationResponse[] };

const CLOSED_ORG_STATUSES = new Set(["REJECTED", "SUSPENDED", "ARCHIVED"]);

function orgStepperIndex(status: string): number {
  if (status === "ACTIVE") return REGISTRY_STEPS.length;
  if (status === "PENDING_VERIFICATION") return 1;
  return 0;
}

const PARTICIPANTS = [
  {
    mark: "01",
    title: "Đơn vị nghiên cứu",
    description: "Trường, viện và phòng lab công bố công nghệ, kết quả nghiên cứu sẵn sàng chuyển giao.",
  },
  {
    mark: "02",
    title: "Doanh nghiệp",
    description: "Tìm kiếm công nghệ phù hợp, đánh giá mức độ sẵn sàng và kết nối với đơn vị sở hữu.",
  },
  {
    mark: "03",
    title: "Cơ quan nhà nước",
    description: "Giám sát, tài trợ hoặc điều phối các chương trình chuyển giao công nghệ.",
  },
  {
    mark: "04",
    title: "Tổ chức hỗ trợ",
    description: "Vườn ươm, quỹ đầu tư và đơn vị trung gian đồng hành cùng quá trình chuyển giao.",
  },
];

export default function HomePage() {
  const [authed, setAuthed] = useState<AuthedSession | null>(null);

  useEffect(() => {
    if (!getAccessToken()) return;
    Promise.all([authFetch<MeResponse>("/me"), authFetch<OrganizationResponse[]>("/organizations")])
      .then(([me, organizations]) => setAuthed({ me, organizations }))
      .catch(() => {
        // token invalid/expired — SiteHeader already handles clearing it; homepage just
        // stays on the guest hero until the user logs in again.
      });
  }, []);

  return (
    <main>
      <SiteHeader />

      <section className="hero">
        <div className="hero__grid" aria-hidden="true" />
        <div className="container hero__inner">
          {authed ? (
            <HomeAuthedHero authed={authed} />
          ) : (
            <div>
              <span className="eyebrow">Sổ đăng ký tổ chức</span>
              <h1 className="hero__headline" style={{ marginTop: "var(--space-4)" }}>
                Nơi nghiên cứu được <em>xác minh</em> để bước ra thị trường.
              </h1>
              <p className="hero__dek">
                R2M là sổ đăng ký cho các tổ chức nghiên cứu, doanh nghiệp và cơ quan nhà nước. Mỗi hồ sơ
                được chuyên viên thẩm định trước khi tổ chức được cấp quyền hoạt động đầy đủ.
              </p>
              <div className="hero__actions">
                <Link href="/register-organization" className="btn btn-primary">
                  Đăng ký tổ chức
                </Link>
                <Link href="/login" className="btn btn-ghost">
                  Đăng nhập
                </Link>
              </div>
            </div>
          )}

          <div className="hero__panel">
            {authed ? (
              <HomeAuthedPanel authed={authed} />
            ) : (
              <div className="dossier">
                <div className="dossier__stub">
                  <span>Quy trình thẩm định</span>
                  <span>03 bước</span>
                </div>
                <div className="dossier__perforation" />
                <div className="dossier__body" style={{ padding: "var(--space-6)" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-6)" }}>
                    <Seal size={104} />
                  </div>
                  <RegistryStepper current={0} />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {!authed && (
        <section className="about">
          <div className="container">
            <Reveal>
              <div className="about__head">
                <span className="eyebrow">Giới thiệu</span>
                <h2>Một sổ đăng ký, bốn nhóm tham gia.</h2>
                <p>
                  Chuyển giao công nghệ cần nhiều bên cùng tin tưởng lẫn nhau trước khi hợp tác. R2M gom bốn
                  nhóm tổ chức vào một hệ thống xác minh chung, để mọi hồ sơ công khai trên nền tảng đều đã
                  qua kiểm tra.
                </p>
              </div>
            </Reveal>

            <div className="about-grid">
              {PARTICIPANTS.map((item, index) => (
                <Reveal key={item.mark} delayMs={index * 90}>
                  <div className="about-card">
                    <span className="about-card__mark">{item.mark}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delayMs={120}>
              <div className="trust">
                <Seal size={72} />
                <div className="trust__body">
                  <h3>Mọi hồ sơ đều để lại dấu vết.</h3>
                  <p>
                    Từ lúc nộp hồ sơ đến khi được xác minh, mỗi thay đổi trạng thái của tổ chức đều được ghi
                    lại đầy đủ. Chuyên viên thẩm định xét duyệt thủ công từng trường hợp — không có tổ chức
                    nào được cấp quyền hoạt động tự động.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <footer className="container" style={{ padding: "var(--space-6) var(--space-5) var(--space-8)" }}>
        <hr className="rule" />
        <p
          style={{
            marginTop: "var(--space-4)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--ink-400)",
          }}
        >
          R2M — Nền tảng đăng ký và xác minh tổ chức cho hoạt động chuyển giao công nghệ.
        </p>
      </footer>
    </main>
  );
}

function HomeAuthedHero({ authed }: { authed: AuthedSession }) {
  const { me, organizations } = authed;
  const roleLabel = PLATFORM_ROLE_LABELS[me.platformRole] ?? me.platformRole;

  return (
    <div>
      <span className="eyebrow">Bảng điều khiển</span>
      <h1 className="hero__headline" style={{ marginTop: "var(--space-4)" }}>
        Chào mừng trở lại, <em>{me.displayName}</em>.
      </h1>
      <p className="hero__dek">
        Bạn đang đăng nhập với vai trò {roleLabel}
        {organizations.length > 0
          ? ` — hiện quản lý ${organizations.length} tổ chức trên R2M.`
          : " — bạn chưa là thành viên của tổ chức nào."}
      </p>
      <div className="hero__actions">
        <Link href="/dashboard" className="btn btn-primary">
          Vào bảng điều khiển
        </Link>
        {me.platformRole !== "USER" ? (
          <Link href="/platform/organization-verifications" className="btn btn-ghost">
            Xét duyệt tổ chức
          </Link>
        ) : organizations.length === 0 ? (
          <Link href="/register-organization" className="btn btn-ghost">
            Đăng ký tổ chức mới
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function HomeAuthedPanel({ authed }: { authed: AuthedSession }) {
  const { organizations } = authed;

  if (organizations.length === 0) {
    return (
      <div className="dossier">
        <div className="dossier__stub">
          <span>Tổ chức của bạn</span>
        </div>
        <div className="dossier__perforation" />
        <div className="dossier__body" style={{ padding: "var(--space-6)", textAlign: "center" }}>
          <p className="empty-state">Bạn chưa là thành viên của tổ chức nào.</p>
          <Link href="/register-organization" className="btn btn-primary" style={{ marginTop: "var(--space-5)" }}>
            Đăng ký tổ chức
          </Link>
        </div>
      </div>
    );
  }

  const primary = organizations[0];

  return (
    <div className="dossier">
      <div className="dossier__stub">
        <span>{primary.name}</span>
        <span>{ORG_TYPE_LABELS[primary.type]}</span>
      </div>
      <div className="dossier__perforation" />
      <div className="dossier__body" style={{ padding: "var(--space-6)" }}>
        {CLOSED_ORG_STATUSES.has(primary.status) ? (
          <div style={{ textAlign: "center" }}>
            <span className={orgStatusBadgeClass(primary.status)}>
              {ORG_STATUS_LABELS[primary.status] ?? primary.status}
            </span>
          </div>
        ) : (
          <RegistryStepper current={orgStepperIndex(primary.status)} />
        )}
        {organizations.length > 1 && (
          <p style={{ marginTop: "var(--space-5)", fontSize: 13, textAlign: "center" }}>
            <Link href="/dashboard" className="nav-link">
              Xem tất cả {organizations.length} tổ chức →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
