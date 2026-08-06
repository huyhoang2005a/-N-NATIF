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
   TÁC GIẢ — R2M UI demo (dữ liệu minh họa, chưa nối API thật)
   Trang: Tổng quan · Xác minh · Tài nguyên (list/mới) · Case (list/chi tiết)
          Đề xuất · Thông báo · Hồ sơ
   ====================================================================== */

const NAV = [
  { label: "Tổng quan", icon: LayoutDashboard, page: "dashboard" },
  { label: "Tài nguyên", icon: Database, page: "resources" },
  { label: "Case của tôi", icon: FolderOpen, page: "cases" },
  { label: "Đề xuất", icon: Send, page: "proposals" },
  { label: "Thông báo", icon: Bell, page: "notifications" },
  { label: "Hồ sơ", icon: User, page: "profile" },
];

const CASES = [
  { id: "c1", name: "Cảm biến sinh học phát hiện sớm bệnh gan", status: "Đang thu thập bằng chứng", tone: "blue", org: "Viện Công nghệ Sinh học" },
  { id: "c2", name: "Vật liệu composite tái chế từ vỏ trấu", status: "Chờ duyệt lộ trình", tone: "amber", org: "Viện Công nghệ Sinh học" },
  { id: "c3", name: "Mô hình dự báo hạn hán vùng ĐBSCL", status: "Đã duyệt lộ trình", tone: "green", org: "Viện Công nghệ Sinh học" },
];

const RESOURCES = [
  { title: "Đặc tính cơ học của composite vỏ trấu", type: "Bài báo", v: "v3", icon: FileText, access: "Công khai" },
  { title: "Dữ liệu quan trắc mực nước 2019-2024", type: "Bộ dữ liệu", v: "v1", icon: Database, access: "Theo tổ chức" },
  { title: "Mã nguồn mô hình LSTM dự báo hạn", type: "Mã nguồn", v: "v2", icon: Code2, access: "Cần cấp quyền" },
];

function DashboardPage({ setPage, openCase }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Không gian nghiên cứu</h1>
          <p className="text-sm text-slate-500">Xin chào, TS. Lê Minh Anh</p>
        </div>
        <StatusPill tone="green"><UserCheck className="h-3 w-3" /> Đã xác minh danh tính</StatusPill>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Tài nguyên đã đăng" value="12" icon={Database} tone="indigo" />
        <StatCard label="Case đang theo dõi" value="4" icon={FolderOpen} tone="slate" />
        <StatCard label="Đề xuất chờ phản hồi" value="2" icon={Bell} tone="amber" />
      </div>

      <Card>
        <SectionHeader title="Case của tôi" action="Xem tất cả" onAction={() => setPage("cases")} />
        <div className="divide-y divide-slate-100">
          {CASES.map((c) => (
            <button key={c.id} onClick={() => openCase(c.id)} className="flex w-full items-center justify-between py-3 text-left hover:bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500">{c.org}</p>
              </div>
              <StatusDot tone={c.tone} label={c.status} />
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Tài nguyên gần đây" action="Đăng tài nguyên mới" onAction={() => setPage("resource-new")} />
        <div className="grid grid-cols-3 gap-3">
          {RESOURCES.map((r) => (
            <div key={r.title} className="rounded-lg border border-slate-200 p-3">
              <r.icon className="mb-2 h-4 w-4 text-slate-400" />
              <p className="text-xs font-medium text-slate-900 leading-snug">{r.title}</p>
              <p className="mt-1 font-mono text-[11px] text-slate-400">{r.type} · {r.v}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ResourcesPage({ setPage }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Tài nguyên của tôi</h1>
        <PrimaryButton icon={Plus} onClick={() => setPage("resource-new")}>Đăng tài nguyên mới</PrimaryButton>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="pb-2 font-medium">Tên tài nguyên</th>
              <th className="pb-2 font-medium">Loại</th>
              <th className="pb-2 font-medium">Phiên bản</th>
              <th className="pb-2 font-medium">Quyền truy cập</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {RESOURCES.map((r) => (
              <tr key={r.title} className="hover:bg-slate-50">
                <td className="flex items-center gap-2 py-3 text-slate-900"><r.icon className="h-4 w-4 text-slate-400" />{r.title}</td>
                <td className="py-3 text-slate-500">{r.type}</td>
                <td className="py-3 font-mono text-slate-500">{r.v}</td>
                <td className="py-3 text-slate-500">{r.access}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ResourceNewPage({ setPage }) {
  return (
    <div className="max-w-xl space-y-6">
      <BackLink onClick={() => setPage("resources")}>Quay lại danh sách tài nguyên</BackLink>
      <h1 className="text-lg font-semibold text-slate-900">Đăng tài nguyên mới</h1>
      <Card className="space-y-4">
        <TextField label="Tên tài nguyên" placeholder="Vd: Đặc tính cơ học của composite vỏ trấu" />
        <SelectField label="Loại tài nguyên" options={["Bài báo", "Bộ dữ liệu", "Mô hình", "Mã nguồn", "Bằng sáng chế", "Kết quả thực nghiệm"]} />
        <TextField label="Mô tả ngắn" as="textarea" placeholder="Tóm tắt nội dung tài nguyên..." />
        <SelectField label="Quyền truy cập" options={["Công khai", "Theo tổ chức", "Chỉ trong case", "Cần cấp quyền", "Riêng tư"]} />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-700">Tệp tài liệu</span>
          <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 py-8 text-sm text-slate-400">
            <Upload className="mr-2 h-4 w-4" /> Kéo thả tệp hoặc bấm để chọn
          </div>
        </label>
        <PrimaryButton full>Đăng tài nguyên</PrimaryButton>
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
                <p className="text-xs text-slate-500">{c.org}</p>
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
          <p className="text-sm text-slate-500">{c.org}</p>
        </div>
        <StatusDot tone={c.tone} label={c.status} />
      </div>

      <Tabs tabs={["Tổng quan", "Bằng chứng", "Đánh giá", "Gap", "Lộ trình"]} active={tab} onChange={setTab} />

      {tab === "Tổng quan" && (
        <Card>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-slate-400">Chủ sở hữu case</dt><dd className="text-slate-900">TS. Lê Minh Anh</dd></div>
            <div><dt className="text-xs text-slate-400">Tổ chức sở hữu</dt><dd className="text-slate-900">{c.org}</dd></div>
            <div><dt className="text-xs text-slate-400">Nguồn khởi tạo</dt><dd className="text-slate-900">Thủ công</dd></div>
            <div><dt className="text-xs text-slate-400">Cập nhật gần nhất</dt><dd className="text-slate-900">3 ngày trước</dd></div>
          </dl>
        </Card>
      )}

      {tab === "Bằng chứng" && (
        <Card>
          <SectionHeader title="Bằng chứng đã liên kết" action="Thêm bằng chứng" />
          <div className="space-y-3">
            {[
              { title: "Kết quả thử nghiệm độ bền kéo", source: "composite-vo-trau-v3.pdf", locator: "tr. 4" },
              { title: "Dữ liệu quan trắc thực địa", source: "quan-trac-2019-2024.csv", locator: "hàng 220-340" },
            ].map((e) => (
              <div key={e.title} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <p className="text-sm text-slate-900">{e.title}</p>
                <CitationChip source={e.source} locator={e.locator} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "Đánh giá" && (
        <Card>
          <SectionHeader title="Đánh giá mức độ sẵn sàng" />
          <div className="mb-3 flex items-center gap-2">
            <span className="font-mono text-2xl font-semibold text-slate-900">3.8</span>
            <span className="text-xs text-slate-400">/ 5.0 điểm tổng hợp</span>
            <StatusPill tone="blue">Đã nộp, chờ duyệt</StatusPill>
          </div>
          <div className="space-y-2">
            {[
              { c: "Mức độ trưởng thành công nghệ", s: 4 },
              { c: "Khả năng mở rộng sản xuất", s: 3 },
              { c: "Tính khả thi thị trường", s: 4 },
            ].map((row) => (
              <div key={row.c} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{row.c}</span>
                <span className="font-mono text-slate-900">{row.s}/5</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "Gap" && (
        <Card>
          <SectionHeader title="Khoảng trống cần xử lý" />
          <div className="space-y-2">
            {[
              { name: "Chưa có dữ liệu thử nghiệm quy mô pilot", tone: "red", sev: "Nghiêm trọng" },
              { name: "Thiếu chứng nhận an toàn vật liệu", tone: "amber", sev: "Trung bình" },
            ].map((g) => (
              <div key={g.name} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <span className="text-sm text-slate-900">{g.name}</span>
                <StatusPill tone={g.tone}>{g.sev}</StatusPill>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "Lộ trình" && (
        <Card>
          <SectionHeader title="Lộ trình thương mại hóa" />
          <div className="space-y-0">
            {[
              { m: "Thử nghiệm quy mô pilot", status: "Hoàn thành", tone: "green" },
              { m: "Xin chứng nhận an toàn vật liệu", status: "Đang thực hiện", tone: "blue" },
              { m: "Đàm phán chuyển giao với đối tác", status: "Chưa bắt đầu", tone: "gray" },
            ].map((m, i) => (
              <div key={m.m} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${STATUS_STYLES[m.tone].dot}`} />
                  {i < 2 && <span className="w-px flex-1 bg-slate-200" />}
                </div>
                <div className="pb-5">
                  <p className="text-sm font-medium text-slate-900">{m.m}</p>
                  <StatusDot tone={m.tone} label={m.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ProposalsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Đề xuất của tôi</h1>
      <Card>
        <div className="divide-y divide-slate-100">
          {[
            { title: "Đề xuất quy trình xử lý nước thải bằng vi tảo", need: "Xử lý nước thải công nghiệp giá rẻ", status: "Chờ xem xét", tone: "blue" },
            { title: "Đề xuất cảm biến khí NH3 chi phí thấp", need: "Giám sát khí thải chuồng trại", status: "Đã chấp nhận", tone: "green" },
          ].map((p) => (
            <div key={p.title} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{p.title}</p>
                <p className="text-xs text-slate-500">Gửi cho nhu cầu: {p.need}</p>
              </div>
              <StatusDot tone={p.tone} label={p.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function NotificationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Thông báo</h1>
      <Card>
        <div className="divide-y divide-slate-100">
          {[
            { icon: CheckCircle2, text: "Lộ trình case \"Mô hình dự báo hạn hán\" đã được duyệt", time: "2 giờ trước" },
            { icon: MessageSquareWarning, text: "Đánh giá case \"Composite vỏ trấu\" cần chỉnh sửa", time: "1 ngày trước" },
            { icon: Send, text: "Doanh nghiệp Sông Hồng chấp nhận đề xuất của bạn", time: "3 ngày trước" },
          ].map((n, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <n.icon className="h-4 w-4 shrink-0 text-slate-400" />
              <p className="flex-1 text-sm text-slate-700">{n.text}</p>
              <span className="text-xs text-slate-400">{n.time}</span>
            </div>
          ))}
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
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-lg font-semibold text-indigo-700">LA</div>
            <div>
              <p className="text-sm font-semibold text-slate-900">TS. Lê Minh Anh</p>
              <p className="text-xs text-slate-500">leminhanh@vien-cnsh.vn</p>
            </div>
          </div>
          <GhostButton icon={Pencil}>Chỉnh sửa</GhostButton>
        </div>
      </Card>
      <Card>
        <SectionHeader title="Trạng thái xác minh tác giả" />
        <div className="mb-4"><StatusPill tone="green"><UserCheck className="h-3 w-3" /> Đã xác minh danh tính</StatusPill></div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-xs text-slate-400">Đơn vị công tác</dt><dd className="text-slate-900">Viện Công nghệ Sinh học</dd></div>
          <div><dt className="text-xs text-slate-400">ORCID</dt><dd className="font-mono text-slate-900">0000-0002-1825-0097</dd></div>
        </dl>
      </Card>
      <Card>
        <SectionHeader title="Bảo mật" />
        <div className="flex items-center justify-between py-1">
          <span className="flex items-center gap-2.5 text-sm text-slate-700"><KeyRound className="h-4 w-4 text-slate-400" /> Mật khẩu</span>
          <GhostButton>Đổi mật khẩu</GhostButton>
        </div>
      </Card>
      <button onClick={onLogout} className="flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700">
        <LogOut className="h-4 w-4" /> Đăng xuất
      </button>
    </div>
  );
}

export default function AuthorApp() {
  const [page, setPage] = useState("dashboard");
  const [activeCase, setActiveCase] = useState(null);

  const openCase = (id) => { setActiveCase(id); setPage("case-detail"); };

  return (
    <Shell brandLabel="R2M · Tác giả" roleLabel="Tác giả" nav={NAV} page={page === "case-detail" ? "cases" : page === "resource-new" ? "resources" : page} setPage={setPage}>
      {page === "dashboard" && <DashboardPage setPage={setPage} openCase={openCase} />}
      {page === "resources" && <ResourcesPage setPage={setPage} />}
      {page === "resource-new" && <ResourceNewPage setPage={setPage} />}
      {page === "cases" && <CasesPage openCase={openCase} />}
      {page === "case-detail" && <CaseDetailPage caseId={activeCase} setPage={setPage} />}
      {page === "proposals" && <ProposalsPage />}
      {page === "notifications" && <NotificationsPage />}
      {page === "profile" && <ProfilePage onLogout={() => setPage("dashboard")} />}
    </Shell>
  );
}
