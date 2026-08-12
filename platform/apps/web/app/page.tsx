"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  ClipboardCheck,
  FileSearch,
  FlaskConical,
  FolderOpen,
  Handshake,
  Landmark,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { authFetch } from "../lib/api-client";
import { getAccessToken } from "../lib/session";
import { BrandMark, PageLoader, PrimaryButtonLink } from "../components/ui";
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

const STEPS = [
  {
    icon: UserCheck,
    title: "Đăng ký & xác minh tổ chức",
    description:
      "Tạo tài khoản tổ chức kèm tài liệu xác minh (giấy tờ thuế hoặc thư xác nhận công tác). Kiểm định viên thẩm định hồ sơ trước khi tổ chức được cấp quyền hoạt động đầy đủ.",
  },
  {
    icon: FileSearch,
    title: "Xác minh tác giả & đăng tài nguyên",
    description:
      "Tác giả xác minh danh tính, sau đó đăng bài báo, bộ dữ liệu hoặc kết quả thực nghiệm — mỗi tài nguyên có phiên bản và quyền truy cập riêng.",
  },
  {
    icon: FolderOpen,
    title: "Tạo Technology Case",
    description:
      "Gom các tài nguyên liên quan thành một hồ sơ công nghệ (case), mỗi luận điểm đều gắn trích dẫn tới đúng phiên bản tài liệu nguồn.",
  },
  {
    icon: ClipboardCheck,
    title: "Đánh giá mức độ sẵn sàng & lộ trình",
    description:
      "Kiểm định viên đánh giá theo khung tiêu chí chuẩn hoá, chỉ ra các khoảng trống (gap) cần xử lý và duyệt lộ trình thương mại hoá.",
  },
  {
    icon: Handshake,
    title: "Kết nối & chuyển giao",
    description:
      "Doanh nghiệp tìm kiếm, đề xuất hợp tác hoặc nhận gói chuyển giao với quyền truy cập từng tài nguyên — có thời hạn, có thể thu hồi.",
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Xác minh hai lớp",
    description: "Cả tổ chức lẫn tác giả đều qua kiểm định viên thẩm định trước khi được cấp quyền hoạt động đầy đủ.",
  },
  {
    icon: FolderOpen,
    title: "Case & bằng chứng có trích dẫn",
    description: "Mỗi luận điểm trong hồ sơ công nghệ đều gắn trích dẫn tới đúng phiên bản tài liệu nguồn, không chỉ mô tả suông.",
  },
  {
    icon: ClipboardCheck,
    title: "Đánh giá mức độ sẵn sàng",
    description: "Khung tiêu chí chuẩn hoá, phát hiện khoảng trống (gap) và theo dõi lộ trình xử lý minh bạch.",
  },
  {
    icon: Sparkles,
    title: "Gợi ý công nghệ",
    description: "Ghép nối nhu cầu doanh nghiệp với tài nguyên nghiên cứu phù hợp dựa trên tìm kiếm toàn văn.",
  },
  {
    icon: Handshake,
    title: "Chuyển giao có kiểm soát",
    description: "Cấp quyền truy cập theo từng tài nguyên, từng người nhận — có thời hạn và có thể thu hồi bất kỳ lúc nào.",
  },
  {
    icon: Users,
    title: "Cộng đồng học thuật",
    description: "Theo dõi tác giả/tổ chức, bình chọn, ghi nhận chuyên môn — xây dựng uy tín minh bạch theo thời gian.",
  },
  {
    icon: Bell,
    title: "Thông báo tức thời",
    description: "Nhận thông báo ngay khi hồ sơ được duyệt, có đề xuất mới hoặc case cần xử lý — không bỏ lỡ bước nào.",
  },
  {
    icon: FileSearch,
    title: "Kiểm duyệt nội dung",
    description: "Nội dung vi phạm có thể bị gắn cờ và được kiểm định viên xử lý, giữ chất lượng dữ liệu trên toàn nền tảng.",
  },
];

function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 400 320"
      style={{ width: "100%", maxWidth: 380, height: "auto" }}
      role="img"
      aria-label="Minh hoạ hồ sơ công nghệ được xác minh trên R2M, kèm trích dẫn và dấu xác minh"
    >
      <rect x="60" y="34" width="264" height="212" rx="18" fill="var(--uikit-indigo-50)" transform="rotate(-5 192 140)" />
      <rect x="38" y="56" width="284" height="228" rx="18" fill="#ffffff" stroke="var(--uikit-slate-200)" />
      <rect x="64" y="86" width="130" height="13" rx="6.5" fill="var(--uikit-slate-700)" />
      <rect x="64" y="107" width="86" height="9" rx="4.5" fill="var(--uikit-slate-400)" />
      <rect x="222" y="84" width="78" height="24" rx="12" fill="var(--uikit-emerald-50)" />
      <circle cx="237" cy="96" r="4.5" fill="var(--uikit-emerald-500)" />
      <rect x="248" y="92" width="42" height="8" rx="4" fill="var(--uikit-emerald-700)" />
      <rect x="64" y="142" width="236" height="9" rx="4.5" fill="var(--uikit-slate-200)" />
      <rect x="64" y="161" width="204" height="9" rx="4.5" fill="var(--uikit-slate-200)" />
      <rect x="64" y="180" width="220" height="9" rx="4.5" fill="var(--uikit-slate-200)" />
      <rect x="64" y="199" width="150" height="9" rx="4.5" fill="var(--uikit-slate-200)" />
      <rect x="64" y="226" width="108" height="24" rx="7" fill="var(--uikit-amber-50)" stroke="var(--uikit-amber-200)" />
      <rect x="76" y="234" width="84" height="8" rx="4" fill="var(--uikit-amber-700)" />
      <circle cx="336" cy="244" r="38" fill="var(--uikit-indigo-700)" />
      <path
        d="M319 244 L331 256 L355 228"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

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

  if (!checked) return <PageLoader />;
  return (
    <main>
      <header style={{ padding: "var(--space-5) 0", position: "sticky", top: 0, background: "var(--paper-50)", zIndex: 10, borderBottom: "1px solid transparent" }}>
        <div className="uikit-page-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BrandMark />
            <span style={{ fontWeight: 600, fontSize: 15 }}>R2M</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", flexWrap: "wrap" }}>
            <a href="#cach-hoat-dong" className="uikit-navlink">
              Cách hoạt động
            </a>
            <a href="#tinh-nang" className="uikit-navlink">
              Tính năng
            </a>
            <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: "var(--uikit-slate-700)", textDecoration: "none" }}>
              Đăng nhập
            </Link>
            <PrimaryButtonLink href="/register-organization">Đăng ký tổ chức</PrimaryButtonLink>
          </nav>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section style={{ padding: "var(--space-8) 0 var(--space-9)" }}>
        <div
          className="uikit-page-container"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", flexWrap: "wrap" }}
        >
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
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
              hồ sơ được kiểm định viên thẩm định trước khi tổ chức được cấp quyền hoạt động đầy đủ
              — từ tài nguyên nghiên cứu, hồ sơ công nghệ có trích dẫn, đến đánh giá mức độ sẵn sàng
              và chuyển giao có kiểm soát quyền truy cập.
            </p>
            <div style={{ marginTop: "var(--space-6)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <PrimaryButtonLink href="/register-organization">Đăng ký tổ chức</PrimaryButtonLink>
              <Link href="/login" className="uikit-btn uikit-btn--ghost-slate">
                Đăng nhập
              </Link>
            </div>
            <div style={{ marginTop: "var(--space-6)", display: "flex", gap: "var(--space-5)", flexWrap: "wrap" }}>
              {[
                { icon: ShieldCheck, label: "Xác minh trước khi hoạt động" },
                { icon: FolderOpen, label: "Bằng chứng có trích dẫn" },
                { icon: Handshake, label: "Quyền truy cập kiểm soát được" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--uikit-slate-500)" }}>
                  <item.icon style={{ width: 16, height: 16, color: "var(--uikit-indigo-700)", flexShrink: 0 }} aria-hidden="true" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", justifyContent: "center" }}>
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* ---------- 4 nhóm tham gia ---------- */}
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

          <div style={{ marginTop: "var(--space-7)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-4)" }}>
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

      {/* ---------- cách hoạt động ---------- */}
      <section id="cach-hoat-dong" style={{ padding: "var(--space-9) 0", borderTop: "1px solid var(--uikit-slate-200)" }}>
        <div className="uikit-page-container">
          <Reveal>
            <div style={{ maxWidth: "56ch" }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--uikit-indigo-700)" }}>
                Quy trình
              </span>
              <h2 style={{ fontSize: 28, marginTop: "var(--space-3)" }}>Cách R2M hoạt động.</h2>
              <p style={{ marginTop: "var(--space-3)", fontSize: 15, color: "var(--uikit-slate-500)" }}>
                Năm bước, từ đăng ký tổ chức đến chuyển giao công nghệ — mỗi bước đều có người
                thẩm định, không có bước nào "tự động duyệt".
              </p>
            </div>
          </Reveal>

          <div className="uikit-steps" style={{ marginTop: "var(--space-7)" }}>
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delayMs={index * 80}>
                <div className="uikit-steps__item">
                  <div className="uikit-steps__marker">
                    <step.icon aria-hidden="true" />
                  </div>
                  <div className="uikit-steps__body">
                    <p className="uikit-steps__index">Bước {index + 1}</p>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{step.title}</h3>
                    <p style={{ marginTop: "var(--space-2)", fontSize: 14, color: "var(--uikit-slate-500)", lineHeight: 1.55 }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- tính năng nổi bật ---------- */}
      <section id="tinh-nang" style={{ padding: "var(--space-9) 0", borderTop: "1px solid var(--uikit-slate-200)" }}>
        <div className="uikit-page-container">
          <Reveal>
            <div style={{ maxWidth: "56ch" }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--uikit-indigo-700)" }}>
                Tính năng
              </span>
              <h2 style={{ fontSize: 28, marginTop: "var(--space-3)" }}>Mọi thứ cần cho một hồ sơ đáng tin.</h2>
              <p style={{ marginTop: "var(--space-3)", fontSize: 15, color: "var(--uikit-slate-500)" }}>
                Từ xác minh danh tính đến chuyển giao có kiểm soát — R2M gộp toàn bộ quy trình vào
                một nơi.
              </p>
            </div>
          </Reveal>

          <div style={{ marginTop: "var(--space-7)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-4)" }}>
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delayMs={index * 60}>
                <div className="uikit-card" style={{ height: "100%" }}>
                  <div className="uikit-statcard__icon uikit-statcard__icon--indigo">
                    <feature.icon aria-hidden="true" />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: "var(--space-3)" }}>{feature.title}</h3>
                  <p style={{ marginTop: "var(--space-2)", fontSize: 13, color: "var(--uikit-slate-500)", lineHeight: 1.55 }}>
                    {feature.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- cta cuối trang ---------- */}
      <section style={{ padding: "var(--space-9) 0", borderTop: "1px solid var(--uikit-slate-200)" }}>
        <div className="uikit-page-container">
          <Reveal>
            <div
              style={{
                background: "var(--uikit-indigo-700)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-7) var(--space-6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--space-5)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ maxWidth: 480 }}>
                <h2 style={{ fontSize: 24, color: "#ffffff" }}>Sẵn sàng đăng ký tổ chức của bạn?</h2>
                <p style={{ marginTop: "var(--space-2)", fontSize: 14, color: "var(--uikit-indigo-50)" }}>
                  Hồ sơ được kiểm định viên xem xét — thường chỉ cần một bộ tài liệu xác minh để bắt đầu.
                </p>
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <Link
                  href="/register-organization"
                  className="uikit-btn"
                  style={{ background: "#ffffff", color: "var(--uikit-indigo-700)" }}
                >
                  Đăng ký tổ chức
                </Link>
                <Link
                  href="/login"
                  className="uikit-btn"
                  style={{ background: "transparent", color: "#ffffff", border: "1px solid rgba(255,255,255,0.4)" }}
                >
                  Đăng nhập
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--uikit-slate-200)" }}>
        <div className="uikit-page-container" style={{ padding: "var(--space-7) 0 var(--space-8)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-6)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BrandMark />
                <span style={{ fontWeight: 600, fontSize: 14 }}>R2M</span>
              </div>
              <p style={{ marginTop: "var(--space-3)", fontSize: 13, color: "var(--uikit-slate-500)", lineHeight: 1.6, maxWidth: "32ch" }}>
                Sổ đăng ký và xác minh cho hoạt động chuyển giao công nghệ giữa nghiên cứu, doanh
                nghiệp và cơ quan nhà nước.
              </p>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-400)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Sản phẩm
              </p>
              <div className="uikit-stack" style={{ marginTop: "var(--space-3)", gap: "var(--space-2)" }}>
                <a href="#cach-hoat-dong" className="uikit-navlink">
                  Cách hoạt động
                </a>
                <a href="#tinh-nang" className="uikit-navlink">
                  Tính năng
                </a>
                <Link href="/register-organization" className="uikit-navlink">
                  Đăng ký tổ chức
                </Link>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--uikit-slate-400)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Tài khoản
              </p>
              <div className="uikit-stack" style={{ marginTop: "var(--space-3)", gap: "var(--space-2)" }}>
                <Link href="/login" className="uikit-navlink">
                  Đăng nhập
                </Link>
                <Link href="/explore" className="uikit-navlink">
                  Khám phá công nghệ
                </Link>
              </div>
            </div>
          </div>
          <p style={{ marginTop: "var(--space-7)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--uikit-slate-400)" }}>
            R2M — Nền tảng đăng ký và xác minh tổ chức cho hoạt động chuyển giao công nghệ.
          </p>
        </div>
      </footer>
    </main>
  );
}
