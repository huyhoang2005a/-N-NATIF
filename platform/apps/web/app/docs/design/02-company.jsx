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
   DOANH NGHIỆP — R2M UI demo (dữ liệu minh họa, chưa nối API thật)
   Trang: Tổng quan · Nhu cầu nghiên cứu (list/mới/chi tiết) · Gợi ý công nghệ
          Đề xuất nhận được · Case của tôi (list/chi tiết) · Hồ sơ
   ====================================================================== */

const NAV = [
  { label: "Tổng quan", icon: LayoutDashboard, page: "dashboard" },
  { label: "Nhu cầu nghiên cứu", icon: Target, page: "needs" },
  { label: "Gợi ý công nghệ", icon: Sparkles, page: "recommendations" },
  { label: "Đề xuất nhận được", icon: Send, page: "proposals" },
  { label: "Case của tôi", icon: FolderOpen, page: "cases" },
  { label: "Hồ sơ", icon: User, page: "profile" },
];

const NEEDS = [
  { id: "n1", title: "Vật liệu phân hủy sinh học thay thế nhựa PE", status: "Đang mở", tone: "green", proposals: 3, recs: 7 },
  { id: "n2", title: "Cảm biến giám sát chất lượng nước thải", status: "Nháp", tone: "gray", proposals: 0, recs: 0 },
  { id: "n3", title: "Quy trình tái chế pin lithium", status: "Đã đóng", tone: "gray", proposals: 5, recs: 4 },
];

const RECS = [
  { title: "Vật liệu composite tái chế từ vỏ trấu", author: "TS. Lê Minh Anh · Viện Công nghệ Sinh học", score: 0.91, source: "composite-vo-trau-v3.pdf", locator: "tr. 4" },
  { title: "Màng sinh học từ tinh bột sắn biến tính", author: "PGS. Trần Văn Hòa · ĐH Bách Khoa", score: 0.84, source: "mang-sinh-hoc-tinh-bot-v2.pdf", locator: "tr. 11" },
  { title: "Bao bì phân hủy từ bã mía ép nhiệt", author: "ThS. Ngô Bảo Châu · Viện Nông nghiệp", score: 0.77, source: "bao-bi-ba-mia.pdf", locator: "tr. 2" },
];

const CASES = [
  { id: "c1", name: "Vật liệu composite tái chế từ vỏ trấu", status: "Đang thu thập bằng chứng", tone: "blue", author: "TS. Lê Minh Anh" },
  { id: "c2", name: "Cảm biến khí NH3 chi phí thấp", status: "Đã duyệt lộ trình", tone: "green", author: "TS. Nguyễn Đức Long" },
];

function DashboardPage({ setPage }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Khám phá công nghệ</h1>
          <p className="text-sm text-slate-500">Công ty Nhựa sinh học Sông Hồng</p>
        </div>
        <PrimaryButton icon={Target} onClick={() => setPage("need-new")}>Đăng nhu cầu nghiên cứu</PrimaryButton>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Nhu cầu đang mở" value="3" icon={Target} tone="indigo" />
        <StatCard label="Gợi ý mới" value="7" icon={Sparkles} tone="amber" />
        <StatCard label="Case đang hợp tác" value="2" icon={FolderOpen} tone="slate" />
      </div>
      <Card>
        <SectionHeader title="Gợi ý công nghệ mới nhất" action="Xem tất cả" onAction={() => setPage("recommendations")} />
        <div className="space-y-3">
          {RECS.slice(0, 2).map((r) => (
            <div key={r.title} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">{r.title}</p>
                <span className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-xs font-semibold text-indigo-700">{Math.round(r.score * 100)}%</span>
              </div>
              <CitationChip source={r.source} locator={r.locator} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionHeader title="Nhu cầu nghiên cứu" action="Xem tất cả" onAction={() => setPage("needs")} />
        <div className="divide-y divide-slate-100">
          {NEEDS.map((n) => (
            <div key={n.id} className="flex items-center justify-between py-3">
              <p className="text-sm text-slate-900">{n.title}</p>
              <StatusDot tone={n.tone} label={n.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function NeedsPage({ setPage, openNeed }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Nhu cầu nghiên cứu</h1>
        <PrimaryButton icon={Plus} onClick={() => setPage("need-new")}>Đăng nhu cầu mới</PrimaryButton>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="pb-2 font-medium">Nhu cầu</th>
              <th className="pb-2 font-medium">Trạng thái</th>
              <th className="pb-2 font-medium">Đề xuất nhận được</th>
              <th className="pb-2 font-medium">Gợi ý AI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {NEEDS.map((n) => (
              <tr key={n.id} onClick={() => openNeed(n.id)} className="cursor-pointer hover:bg-slate-50">
                <td className="py-3 font-medium text-slate-900">{n.title}</td>
                <td className="py-3"><StatusDot tone={n.tone} label={n.status} /></td>
                <td className="py-3 font-mono text-slate-500">{n.proposals}</td>
                <td className="py-3 font-mono text-slate-500">{n.recs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function NeedNewPage({ setPage }) {
  return (
    <div className="max-w-xl space-y-6">
      <BackLink onClick={() => setPage("needs")}>Quay lại danh sách nhu cầu</BackLink>
      <h1 className="text-lg font-semibold text-slate-900">Đăng nhu cầu nghiên cứu mới</h1>
      <Card className="space-y-4">
        <TextField label="Tiêu đề nhu cầu" placeholder="Vd: Vật liệu phân hủy sinh học thay thế nhựa PE" />
        <SelectField label="Lĩnh vực kỹ thuật" options={["Vật liệu", "Năng lượng", "Môi trường", "Công nghệ sinh học", "Điện tử - Cảm biến"]} />
        <TextField label="Mô tả vấn đề cần giải quyết" as="textarea" placeholder="Mô tả cụ thể vấn đề, quy mô, ràng buộc kỹ thuật..." />
        <TextField label="Loại đầu ra mong muốn" placeholder="Vd: vật liệu sẵn sàng thử nghiệm pilot" />
        <p className="text-xs text-slate-400">Nhu cầu sẽ ở trạng thái Nháp — cần bấm Đăng để mở cho tác giả nộp đề xuất và AI bắt đầu gợi ý.</p>
        <div className="flex gap-2">
          <GhostButton>Lưu nháp</GhostButton>
          <PrimaryButton>Đăng nhu cầu</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}

function NeedDetailPage({ needId, setPage }) {
  const n = NEEDS.find((x) => x.id === needId) || NEEDS[0];
  return (
    <div className="space-y-5">
      <BackLink onClick={() => setPage("needs")}>Quay lại danh sách nhu cầu</BackLink>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{n.title}</h1>
        <StatusDot tone={n.tone} label={n.status} />
      </div>
      <Card>
        <SectionHeader title="Mô tả nhu cầu (phiên bản hiện hành)" />
        <p className="text-sm text-slate-700">
          Cần vật liệu bao bì phân hủy sinh học trong môi trường tự nhiên dưới 180 ngày, chi phí sản xuất
          không vượt quá 120% so với nhựa PE hiện dùng, phù hợp quy mô sản xuất công nghiệp.
        </p>
      </Card>
      <Card>
        <SectionHeader title={`Gợi ý AI (${n.recs})`} action="Xem tất cả gợi ý" />
        <div className="space-y-3">
          {RECS.slice(0, 2).map((r) => (
            <div key={r.title} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{r.title}</p>
                <CitationChip source={r.source} locator={r.locator} />
              </div>
              <span className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-xs font-semibold text-indigo-700">{Math.round(r.score * 100)}%</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Gợi ý công nghệ</h1>
      <Card>
        <SectionHeader title='Cho nhu cầu "Vật liệu phân hủy sinh học thay thế nhựa PE"' />
        <div className="space-y-3">
          {RECS.map((r) => (
            <div key={r.title} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{r.title}</p>
                  <p className="text-xs text-slate-500">{r.author}</p>
                </div>
                <span className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-xs font-semibold text-indigo-700">{Math.round(r.score * 100)}% phù hợp</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <CitationChip source={r.source} locator={r.locator} />
                <div className="flex gap-2">
                  <GhostButton>Bỏ qua</GhostButton>
                  <PrimaryButton>Khởi tạo hợp tác</PrimaryButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ProposalsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Đề xuất nhận được</h1>
      <Card>
        <div className="divide-y divide-slate-100">
          {[
            { title: "Đề xuất quy trình xử lý nước thải bằng vi tảo", author: "ThS. Phạm Thu Trang", status: "Chờ xem xét", tone: "blue" },
            { title: "Đề xuất cảm biến khí NH3 chi phí thấp", author: "TS. Nguyễn Đức Long", status: "Đã chấp nhận", tone: "green" },
          ].map((p) => (
            <div key={p.title} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{p.title}</p>
                <p className="text-xs text-slate-500">{p.author}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusDot tone={p.tone} label={p.status} />
                {p.status === "Chờ xem xét" && (
                  <div className="flex gap-2">
                    <GhostButton tone="red">Từ chối</GhostButton>
                    <GhostButton tone="green">Chấp nhận</GhostButton>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CasesPage({ openCase }) {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Case của tôi</h1>
      <Card>
        <div className="divide-y divide-slate-100">
          {CASES.map((c) => (
            <button key={c.id} onClick={() => openCase(c.id)} className="flex w-full items-center justify-between py-3 text-left hover:bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500">Tác giả: {c.author}</p>
              </div>
              <StatusDot tone={c.tone} label={c.status} />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CaseDetailPage({ caseId, setPage }) {
  const [tab, setTab] = useState("Tổng quan");
  const c = CASES.find((x) => x.id === caseId) || CASES[0];
  return (
    <div className="space-y-5">
      <BackLink onClick={() => setPage("cases")}>Quay lại danh sách case</BackLink>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{c.name}</h1>
          <p className="text-sm text-slate-500">Tác giả: {c.author}</p>
        </div>
        <StatusDot tone={c.tone} label={c.status} />
      </div>
      <Tabs tabs={["Tổng quan", "Đánh giá", "Lộ trình"]} active={tab} onChange={setTab} />
      {tab === "Tổng quan" && (
        <Card>
          <p className="text-sm text-slate-600">Bạn tham gia case này với vai trò Thành viên đối tác (Partner Member) — có thể xem tiến trình và bổ sung tài liệu, không thể tự duyệt đánh giá/lộ trình.</p>
        </Card>
      )}
      {tab === "Đánh giá" && (
        <Card>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-semibold text-slate-900">3.8</span>
            <span className="text-xs text-slate-400">/ 5.0 điểm tổng hợp</span>
          </div>
        </Card>
      )}
      {tab === "Lộ trình" && (
        <Card>
          {[
            { m: "Thử nghiệm quy mô pilot", status: "Hoàn thành", tone: "green" },
            { m: "Xin chứng nhận an toàn vật liệu", status: "Đang thực hiện", tone: "blue" },
          ].map((m) => (
            <div key={m.m} className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-900">{m.m}</span>
              <StatusDot tone={m.tone} label={m.status} />
            </div>
          ))}
        </Card>
      )}
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
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-lg font-semibold text-indigo-700">PH</div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Phạm Thu Hương</p>
              <p className="text-xs text-slate-500">huong.pham@nhuasinhhocsonghong.vn</p>
            </div>
          </div>
          <GhostButton icon={Pencil}>Chỉnh sửa</GhostButton>
        </div>
      </Card>
      <Card>
        <SectionHeader title="Tổ chức" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Công ty Nhựa sinh học Sông Hồng</p>
            <p className="text-xs text-slate-500">Doanh nghiệp · Đã kích hoạt</p>
          </div>
          <StatusPill tone="green"><CheckCircle2 className="h-3 w-3" /> Chủ sở hữu tổ chức</StatusPill>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Thành viên (4)</p>
            <GhostButton>Mời thành viên</GhostButton>
          </div>
          {["Trần Đức Anh · Quản trị viên tổ chức", "Vũ Ngọc Mai · Thành viên"].map((m) => (
            <div key={m} className="flex items-center gap-2 py-1.5 text-sm text-slate-700">
              <span className="h-6 w-6 rounded-full bg-slate-200" /> {m}
            </div>
          ))}
        </div>
      </Card>
      <button onClick={onLogout} className="flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700">
        <LogOut className="h-4 w-4" /> Đăng xuất
      </button>
    </div>
  );
}

export default function CompanyApp() {
  const [page, setPage] = useState("dashboard");
  const [activeNeed, setActiveNeed] = useState(null);
  const [activeCase, setActiveCase] = useState(null);

  const openNeed = (id) => { setActiveNeed(id); setPage("need-detail"); };
  const openCase = (id) => { setActiveCase(id); setPage("case-detail"); };

  const navPage = ["need-detail", "need-new"].includes(page) ? "needs" : page === "case-detail" ? "cases" : page;

  return (
    <Shell brandLabel="R2M · Doanh nghiệp" roleLabel="Doanh nghiệp" nav={NAV} page={navPage} setPage={setPage}>
      {page === "dashboard" && <DashboardPage setPage={setPage} />}
      {page === "needs" && <NeedsPage setPage={setPage} openNeed={openNeed} />}
      {page === "need-new" && <NeedNewPage setPage={setPage} />}
      {page === "need-detail" && <NeedDetailPage needId={activeNeed} setPage={setPage} />}
      {page === "recommendations" && <RecommendationsPage />}
      {page === "proposals" && <ProposalsPage />}
      {page === "cases" && <CasesPage openCase={openCase} />}
      {page === "case-detail" && <CaseDetailPage caseId={activeCase} setPage={setPage} />}
      {page === "profile" && <ProfilePage onLogout={() => setPage("dashboard")} />}
    </Shell>
  );
}
