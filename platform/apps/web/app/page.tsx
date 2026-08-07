"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, FlaskConical, Landmark, ShieldCheck, Sparkles } from "lucide-react";
import { authFetch } from "../lib/api-client";
import { getAccessToken } from "../lib/session";
import { BrandMark, PrimaryButtonLink } from "../components/ui";
import { Reveal } from "./_components/Reveal";
import type { MeResponse } from "@r2m/contracts";

const PARTICIPANTS = [
  {
    icon: FlaskConical,
    title: "Đơn vị nghiên cứu",
    description: "Trường, viện và phòng lab công bố công nghệ, kết quả nghiên cứu sẵn sàng chuyển giao.",
  },
  {
    icon: Building2,
    title: "Doanh nghiệp",
    description: "Tìm kiếm công nghệ phù hợp, đánh giá mức độ sẵn sàng và kết nối với đơn vị sở hữu.",
  },
  {
    icon: Landmark,
    title: "Cơ quan nhà nước",
    description: "Giám sát, tài trợ hoặc điều phối các chương trình chuyển giao công nghệ.",
  },
  {
    icon: Sparkles,
    title: "Tổ chức hỗ trợ",
    description: "Vườn ươm, quỹ đầu tư và đơn vị trung gian đồng hành cùng quá trình chuyển giao.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      setChecked(true);
      return;
    }
    // Đã đăng nhập — không cần 1 mini-dashboard riêng ở trang chủ, đưa thẳng
    // sang /dashboard (đúng "1 role, 1 nơi hiển thị").
    authFetch<MeResponse>("/me")
      .then(() => router.replace("/dashboard"))
      .catch(() => setChecked(true));
  }, [router]);

  if (!checked) return null;

  return (
    <main>
      <header style={{ padding: "var(--space-5) 0" }}>
        <div className="uikit-page-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BrandMark />
            <span style={{ fontWeight: 600, fontSize: 15 }}>R2M</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
            <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: "var(--uikit-slate-700)", textDecoration: "none" }}>
              Đăng nhập
            </Link>
            <PrimaryButtonLink href="/register-organization">Đăng ký tổ chức</PrimaryButtonLink>
          </nav>
        </div>
      </header>

      <section style={{ padding: "var(--space-9) 0" }}>
        <div className="uikit-page-container" style={{ maxWidth: 640, textAlign: "center", margin: "0 auto" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--uikit-indigo-700)",
            }}
          >
            <ShieldCheck style={{ width: 14, height: 14 }} aria-hidden="true" />
            Sổ đăng ký tổ chức
          </span>
          <h1 style={{ fontSize: 40, marginTop: "var(--space-4)", lineHeight: 1.15 }}>
            Nơi nghiên cứu được xác minh để bước ra thị trường.
          </h1>
          <p style={{ marginTop: "var(--space-4)", fontSize: 16, color: "var(--uikit-slate-500)" }}>
            R2M là sổ đăng ký cho các tổ chức nghiên cứu, doanh nghiệp và cơ quan nhà nước. Mỗi
            hồ sơ được kiểm định viên thẩm định trước khi tổ chức được cấp quyền hoạt động đầy đủ.
          </p>
          <div style={{ marginTop: "var(--space-6)", display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
            <PrimaryButtonLink href="/register-organization">Đăng ký tổ chức</PrimaryButtonLink>
            <Link href="/login" className="uikit-btn uikit-btn--ghost-slate">
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>

      <section style={{ padding: "var(--space-9) 0", borderTop: "1px solid var(--uikit-slate-200)" }}>
        <div className="uikit-page-container">
          <Reveal>
            <div style={{ maxWidth: "56ch" }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--uikit-indigo-700)" }}>
                Giới thiệu
              </span>
              <h2 style={{ fontSize: 28, marginTop: "var(--space-3)" }}>Một sổ đăng ký, bốn nhóm tham gia.</h2>
              <p style={{ marginTop: "var(--space-3)", fontSize: 15, color: "var(--uikit-slate-500)" }}>
                Chuyển giao công nghệ cần nhiều bên cùng tin tưởng lẫn nhau trước khi hợp tác. R2M
                gom bốn nhóm tổ chức vào một hệ thống xác minh chung, để mọi hồ sơ công khai trên
                nền tảng đều đã qua kiểm tra.
              </p>
            </div>
          </Reveal>

          <div style={{ marginTop: "var(--space-7)", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
            {PARTICIPANTS.map((item, index) => (
              <Reveal key={item.title} delayMs={index * 90}>
                <div className="uikit-card" style={{ height: "100%" }}>
                  <div className="uikit-statcard__icon uikit-statcard__icon--indigo">
                    <item.icon aria-hidden="true" />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: "var(--space-3)" }}>{item.title}</h3>
                  <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--uikit-slate-500)", lineHeight: 1.55 }}>
                    {item.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <footer className="uikit-page-container" style={{ padding: "var(--space-6) 0 var(--space-8)", borderTop: "1px solid var(--uikit-slate-200)" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--uikit-slate-400)" }}>
          R2M — Nền tảng đăng ký và xác minh tổ chức cho hoạt động chuyển giao công nghệ.
        </p>
      </footer>
    </main>
  );
}
