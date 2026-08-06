import React, { useState } from "react";
import {
  LayoutDashboard, ShieldCheck, Building2, Users, FlaskConical, FolderOpen,
  Bell, Flag, Sparkles, ClipboardCheck, Search, ChevronRight, ChevronLeft,
  FileText, Database, Code2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Target, GitBranch, Milestone, Send, Eye, UserCheck, Lock, Mail, User,
  LogOut, Pencil, ShieldAlert, KeyRound, Smartphone, Globe, Upload, Plus,
  ArrowLeft, Link2, MessageSquareWarning, FileCheck2, ExternalLink,
} from "lucide-react";

const STATUS_STYLES = {
  gray: { dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-700" },
  blue: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-800" },
  green: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-800" },
  amber: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-800" },
  red: { dot: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-800" },
};

function StatusPill({ tone = "gray", children }) {
  const s = STATUS_STYLES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {children}
    </span>
  );
}

function StatusDot({ tone = "gray", label }) {
  const s = STATUS_STYLES[tone];
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-700">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

function CitationChip({ source, locator }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-xs text-amber-800">
      <FileText className="h-3 w-3" />
      {source} <span className="text-amber-600">· {locator}</span>
    </span>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>{children}</div>;
}

function StatCard({ label, value, icon: Icon, tone = "slate" }) {
  const toneMap = {
    slate: "text-slate-500 bg-slate-100",
    indigo: "text-indigo-700 bg-indigo-50",
    amber: "text-amber-700 bg-amber-50",
    rose: "text-rose-700 bg-rose-50",
    green: "text-emerald-700 bg-emerald-50",
  };
  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneMap[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-mono text-2xl font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {action && (
        <button onClick={onAction} className="flex items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-800">
          {action} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function PrimaryButton({ children, icon: Icon, onClick, full = false }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-1.5 rounded-lg bg-indigo-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-800 ${full ? "w-full" : ""}`}>
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

function GhostButton({ children, tone = "slate", onClick, icon: Icon }) {
  const toneMap = {
    slate: "text-slate-700 border-slate-200 hover:bg-slate-50",
    green: "text-emerald-700 border-emerald-200 hover:bg-emerald-50",
    red: "text-rose-700 border-rose-200 hover:bg-rose-50",
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${toneMap[tone]}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

function TextField({ label, type = "text", placeholder, icon: Icon, hint, as }) {
  const Comp = as === "textarea" ? "textarea" : "input";
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-700">{label}</span>
      <span className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
        <Comp type={type} placeholder={placeholder} rows={as === "textarea" ? 3 : undefined}
          className="w-full resize-none border-0 p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0" />
      </span>
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function SelectField({ label, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-700">{label}</span>
      <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function BrandMark({ size = "md" }) {
  const s = size === "lg" ? "h-10 w-10 text-sm" : "h-7 w-7 text-xs";
  return <div className={`flex ${s} items-center justify-center rounded-lg bg-indigo-700 font-mono font-bold text-white`}>R2</div>;
}

function BackLink({ onClick, children }) {
  return (
    <button onClick={onClick} className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">
      <ArrowLeft className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mb-5 flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${active === t ? "border-indigo-700 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

function Shell({ brandLabel, nav, page, setPage, children, roleLabel }) {
  return (
    <div className="min-h-[760px] w-full bg-slate-50 font-sans text-slate-900">
      <div className="flex">
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-white px-3 py-5">
          <div className="mb-6 flex items-center gap-2 px-2">
            <BrandMark />
            <span className="text-sm font-semibold text-slate-900">{brandLabel}</span>
          </div>
          <nav className="space-y-0.5">
            {nav.map((item) => (
              <button key={item.label} onClick={() => item.page && setPage(item.page)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
                  page === item.page ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                }`}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="flex-1">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
            <div className="flex w-80 items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-400">
              <Search className="h-4 w-4" /> Tìm kiếm...
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{roleLabel}</span>
              <Bell className="h-4.5 w-4.5 text-slate-400" />
              <button onClick={() => setPage("profile")} className="h-7 w-7 rounded-full bg-slate-200" aria-label="Hồ sơ" />
            </div>
          </div>
          <main className="px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

/* ======================================================================
   KIỂM ĐỊNH — R2M UI demo (dữ liệu minh họa, chưa nối API thật)
   Trang: Tổng quan · Xác minh danh tính (list/chi tiết) ·
          Duyệt đánh giá & lộ trình (list/chi tiết) · Kiểm duyệt nội dung · Hồ sơ
   ====================================================================== */

const NAV = [
  { label: "Tổng quan", icon: LayoutDashboard, page: "dashboard" },
  { label: "Xác minh danh tính", icon: ShieldCheck, page: "verifications" },
  { label: "Duyệt đánh giá & lộ trình", icon: ClipboardCheck, page: "reviews" },
  { label: "Kiểm duyệt nội dung", icon: Flag, page: "flags" },
  { label: "Hồ sơ", icon: User, page: "profile" },
];

const VERIFICATIONS = [
  { id: "v1", name: "TS. Vũ Quang Huy", type: "Tác giả", org: "ĐH Khoa học Tự nhiên", submitted: "2 giờ trước" },
  { id: "v2", name: "Công ty TNHH Vật liệu mới Đông Á", type: "Tổ chức", org: "—", submitted: "5 giờ trước" },
  { id: "v3", name: "ThS. Đặng Bảo Ngọc", type: "Tác giả", org: "Viện Hàn lâm KH&CN", submitted: "1 ngày trước" },
];

const REVIEWS = [
  { id: "r1", case: "Cảm biến sinh học phát hiện sớm bệnh gan", kind: "Đánh giá mức độ sẵn sàng", score: "3.8 / 5.0", critical: 0 },
  { id: "r2", case: "Vật liệu composite tái chế từ vỏ trấu", kind: "Lộ trình thương mại hóa", score: "6 mốc · 2 phụ thuộc", critical: 1 },
];

function DashboardPage({ setPage }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Hàng chờ kiểm định</h1>
        <p className="text-sm text-slate-500">Kiểm định viên · Nguyễn Thị Hạnh</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Xác minh chờ duyệt" value="9" icon={ShieldCheck} tone="amber" />
        <StatCard label="Đánh giá & lộ trình chờ duyệt" value="5" icon={ClipboardCheck} tone="indigo" />
        <StatCard label="Nội dung bị gắn cờ" value="1" icon={Flag} tone="rose" />
      </div>
      <Card>
        <SectionHeader title="Yêu cầu xác minh gần nhất" action="Xem tất cả" onAction={() => setPage("verifications")} />
        <div className="divide-y divide-slate-100">
          {VERIFICATIONS.slice(0, 2).map((v) => (
            <div key={v.id} className="flex items-center justify-between py-3">
              <p className="text-sm text-slate-900">{v.name}</p>
              <span className="text-xs text-slate-400">{v.submitted}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function VerificationsPage({ openVerification }) {
  const [tab, setTab] = useState("Tất cả");
  const items = tab === "Tất cả" ? VERIFICATIONS : VERIFICATIONS.filter((v) => v.type === tab);
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Yêu cầu xác minh danh tính</h1>
      <Tabs tabs={["Tất cả", "Tác giả", "Tổ chức"]} active={tab} onChange={setTab} />
      <Card>
        <div className="divide-y divide-slate-100">
          {items.map((v) => (
            <button key={v.id} onClick={() => openVerification(v.id)} className="flex w-full items-center justify-between py-3 text-left hover:bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-900">{v.name}</p>
                <p className="text-xs text-slate-500">{v.type} · {v.org} · nộp {v.submitted}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function VerificationDetailPage({ verId, setPage }) {
  const v = VERIFICATIONS.find((x) => x.id === verId) || VERIFICATIONS[0];
  return (
    <div className="max-w-2xl space-y-5">
      <BackLink onClick={() => setPage("verifications")}>Quay lại danh sách xác minh</BackLink>
      <h1 className="text-lg font-semibold text-slate-900">{v.name}</h1>
      <Card>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-xs text-slate-400">Loại yêu cầu</dt><dd className="text-slate-900">{v.type}</dd></div>
          <div><dt className="text-xs text-slate-400">Đơn vị khai báo</dt><dd className="text-slate-900">{v.org}</dd></div>
          <div><dt className="text-xs text-slate-400">Ngày nộp</dt><dd className="text-slate-900">{v.submitted}</dd></div>
          <div><dt className="text-xs text-slate-400">Trạng thái</dt><dd><StatusPill tone="amber">Chờ duyệt</StatusPill></dd></div>
        </dl>
      </Card>
      <Card>
        <SectionHeader title="Tài liệu đính kèm" />
        <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
          <span className="flex items-center gap-2 text-sm text-slate-700"><FileCheck2 className="h-4 w-4 text-slate-400" /> giay-to-xac-minh.pdf</span>
          <GhostButton icon={ExternalLink}>Xem tài liệu</GhostButton>
        </div>
      </Card>
      <Card>
        <SectionHeader title="Ghi chú duyệt" />
        <TextField label="Ghi chú (hiển thị cho người nộp nếu từ chối)" as="textarea" placeholder="Vd: Cần bổ sung giấy phép kinh doanh còn hiệu lực..." />
        <div className="mt-4 flex gap-2">
          <GhostButton tone="red">Từ chối</GhostButton>
          <PrimaryButton icon={CheckCircle2}>Duyệt xác minh</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}

function ReviewsPage({ openReview }) {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Đánh giá & lộ trình chờ duyệt</h1>
      <Card>
        <div className="space-y-3">
          {REVIEWS.map((r) => (
            <button key={r.id} onClick={() => openReview(r.id)} className="w-full rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{r.case}</p>
                  <p className="text-xs text-slate-500">{r.kind}</p>
                </div>
                <span className="font-mono text-sm font-semibold text-slate-700">{r.score}</span>
              </div>
              <div className="mt-2">
                {r.critical > 0 ? (
                  <StatusPill tone="red"><AlertTriangle className="h-3 w-3" /> {r.critical} gap nghiêm trọng chưa xử lý</StatusPill>
                ) : (
                  <StatusPill tone="green"><CheckCircle2 className="h-3 w-3" /> Không có gap nghiêm trọng</StatusPill>
                )}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ReviewDetailPage({ reviewId, setPage }) {
  const r = REVIEWS.find((x) => x.id === reviewId) || REVIEWS[0];
  const isAssessment = r.kind.includes("Đánh giá");
  return (
    <div className="max-w-2xl space-y-5">
      <BackLink onClick={() => setPage("reviews")}>Quay lại hàng chờ duyệt</BackLink>
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{r.case}</h1>
        <p className="text-sm text-slate-500">{r.kind}</p>
      </div>

      {isAssessment ? (
        <Card>
          <SectionHeader title="Điểm theo tiêu chí" />
          <div className="space-y-2">
            {[
              { c: "Mức độ trưởng thành công nghệ", s: 4, source: "bao-cao-thu-nghiem.pdf", locator: "tr. 8" },
              { c: "Khả năng mở rộng sản xuất", s: 3, source: "khao-sat-nha-may.pdf", locator: "tr. 2" },
              { c: "Tính khả thi thị trường", s: 4, source: "phan-tich-thi-truong.pdf", locator: "tr. 15" },
            ].map((row) => (
              <div key={row.c} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm text-slate-900">{row.c}</span>
                  <span className="font-mono text-sm font-semibold text-slate-700">{row.s}/5</span>
                </div>
                <CitationChip source={row.source} locator={row.locator} />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <SectionHeader title="Mốc lộ trình" />
          <div className="space-y-2">
            {[
              { m: "Thử nghiệm quy mô pilot", dep: "Không phụ thuộc" },
              { m: "Xin chứng nhận an toàn vật liệu", dep: "Sau: Thử nghiệm quy mô pilot" },
              { m: "Đàm phán chuyển giao với đối tác", dep: "Sau: Xin chứng nhận an toàn vật liệu" },
            ].map((m) => (
              <div key={m.m} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm text-slate-900">{m.m}</p>
                <p className="text-xs text-slate-400">{m.dep}</p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <StatusPill tone="red"><AlertTriangle className="h-3 w-3" /> 1 gap nghiêm trọng chưa xử lý — không thể duyệt</StatusPill>
          </div>
        </Card>
      )}

      <Card>
        <TextField label="Ghi chú duyệt" as="textarea" placeholder="Nhận xét cho người nộp..." />
        <div className="mt-4 flex gap-2">
          <GhostButton>Yêu cầu chỉnh sửa</GhostButton>
          <PrimaryButton icon={CheckCircle2}>Duyệt</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}

function FlagsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Kiểm duyệt nội dung</h1>
      <Card>
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-900">Bình luận trên case &quot;Pin thể rắn dung lượng cao&quot;</p>
            <StatusPill tone="red"><Flag className="h-3 w-3" /> Chờ xử lý</StatusPill>
          </div>
          <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            &quot;Công nghệ này đã được công ty X thương mại hóa từ 2019, thông tin trong case sai sự thật...&quot;
          </p>
          <p className="mb-3 text-xs text-slate-400">Lý do gắn cờ: Nội dung gây hiểu nhầm · Người gắn cờ: ẩn danh</p>
          <div className="flex gap-2">
            <GhostButton>Bỏ qua cờ báo</GhostButton>
            <GhostButton tone="red">Ẩn nội dung</GhostButton>
            <PrimaryButton>Xóa nội dung</PrimaryButton>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ProfilePage({ onLogout }) {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Hồ sơ tài khoản</h1>
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-lg font-semibold text-indigo-700">NH</div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Nguyễn Thị Hạnh</p>
              <p className="text-xs text-slate-500">hanh.nguyen@r2m.vn</p>
            </div>
          </div>
          <GhostButton icon={Pencil}>Chỉnh sửa</GhostButton>
        </div>
      </Card>
      <Card>
        <SectionHeader title="Vai trò nền tảng" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Kiểm định viên nền tảng</p>
            <p className="text-xs text-slate-500">Được duyệt: xác minh danh tính, đánh giá & lộ trình, kiểm duyệt nội dung</p>
          </div>
          <StatusPill tone="blue"><ShieldCheck className="h-3 w-3" /> Đang hoạt động</StatusPill>
        </div>
      </Card>
      <button onClick={onLogout} className="flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700">
        <LogOut className="h-4 w-4" /> Đăng xuất
      </button>
    </div>
  );
}

export default function VerifierApp() {
  const [page, setPage] = useState("dashboard");
  const [activeVer, setActiveVer] = useState(null);
  const [activeReview, setActiveReview] = useState(null);

  const openVerification = (id) => { setActiveVer(id); setPage("verification-detail"); };
  const openReview = (id) => { setActiveReview(id); setPage("review-detail"); };

  const navPage = page === "verification-detail" ? "verifications" : page === "review-detail" ? "reviews" : page;

  return (
    <Shell brandLabel="R2M · Kiểm định" roleLabel="Kiểm định viên" nav={NAV} page={navPage} setPage={setPage}>
      {page === "dashboard" && <DashboardPage setPage={setPage} />}
      {page === "verifications" && <VerificationsPage openVerification={openVerification} />}
      {page === "verification-detail" && <VerificationDetailPage verId={activeVer} setPage={setPage} />}
      {page === "reviews" && <ReviewsPage openReview={openReview} />}
      {page === "review-detail" && <ReviewDetailPage reviewId={activeReview} setPage={setPage} />}
      {page === "flags" && <FlagsPage />}
      {page === "profile" && <ProfilePage onLogout={() => setPage("dashboard")} />}
    </Shell>
  );
}
