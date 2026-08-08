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
   PHASE 5 — COMPANY & DISCOVERY (bao gồm Feed) — R2M UI demo
   Dữ liệu minh họa, chưa nối API thật. Bám đúng 06_phase5_full_design.md:
   - Feed (FEED run, dựa company_profile) tách biệt với
     Gợi ý AI theo nhu cầu cụ thể (FOCUSED run, trong Need detail)
   - Nút "Quan tâm" ở cả Feed lẫn Gợi ý FOCUSED đều tạo cùng 1 loại
     case_initiation_request — demo bằng 1 flow xác nhận dùng chung
   - Có cả 2 phía: Doanh nghiệp (khám phá) và Tác giả (nhận yêu cầu)
   ====================================================================== */

const PERSONAS = [
  { key: "company", label: "Doanh nghiệp" },
  { key: "author", label: "Tác giả · nhận yêu cầu" },
];

const NAV_COMPANY = [
  { label: "Feed khám phá", icon: Sparkles, page: "feed" },
  { label: "Nhu cầu nghiên cứu", icon: Target, page: "needs" },
  { label: "Hồ sơ công ty", icon: Building2, page: "company-profile" },
];

const NAV_AUTHOR = [
  { label: "Đề xuất của tôi", icon: Send, page: "proposals" },
  { label: "Yêu cầu hợp tác nhận được", icon: FlaskConical, page: "initiations" },
];

const FEED_ITEMS = [
  { id: "f1", title: "Vật liệu composite tái chế từ vỏ trấu", authorName: "TS. Lê Minh Anh", authorSlug: "le-minh-anh", orgName: "Viện Công nghệ Sinh học", orgSlug: "vien-cong-nghe-sinh-hoc", score: 0.78, source: "composite-vo-trau-v3.pdf", locator: "tr. 4", type: "Bài báo", year: 2024,
    abstract: "Nghiên cứu trình bày quy trình chế tạo vật liệu composite từ vỏ trấu tái chế, đạt độ bền kéo tương đương composite gốc dầu mỏ trong khi giảm 40% chi phí nguyên liệu. Vật liệu được thử nghiệm ở quy mô phòng thí nghiệm với 3 tỷ lệ phối trộn khác nhau, cho thấy khả năng ứng dụng vào sản xuất bao bì công nghiệp và vật liệu xây dựng nhẹ." },
  { id: "f2", title: "Cảm biến khí NH3 chi phí thấp cho nông nghiệp", authorName: "TS. Nguyễn Đức Long", authorSlug: "nguyen-duc-long", orgName: "ĐH Bách Khoa Hà Nội", orgSlug: "dh-bach-khoa-ha-noi", score: 0.71, source: "cam-bien-nh3.pdf", locator: "tr. 9", type: "Bài báo", year: 2023,
    abstract: "Thiết kế cảm biến khí NH3 dựa trên vật liệu oxit kim loại, chi phí sản xuất dưới 50.000đ/đơn vị, phù hợp lắp đặt mật độ cao trong chuồng trại chăn nuôi để giám sát liên tục nồng độ khí thải, cảnh báo sớm khi vượt ngưỡng an toàn." },
  { id: "f3", title: "Quy trình ủ vi sinh xử lý phụ phẩm nông nghiệp", authorName: "PGS. Trần Văn Hòa", authorSlug: "tran-van-hoa", orgName: "Viện Nông nghiệp", orgSlug: "vien-nong-nghiep", score: 0.64, source: "u-vi-sinh-phu-pham.pdf", locator: "tr. 15", type: "Bộ dữ liệu", year: 2024,
    abstract: "Bộ dữ liệu quan trắc quá trình ủ vi sinh xử lý phụ phẩm nông nghiệp (rơm rạ, vỏ trấu, bã mía) trong 90 ngày, ghi nhận nhiệt độ, độ ẩm, thành phần vi sinh vật theo từng giai đoạn — phục vụ tối ưu hóa quy trình ủ compost quy mô trang trại." },
];

const NEEDS = [
  { id: "n1", title: "Vật liệu phân hủy sinh học thay thế nhựa PE", status: "Đang mở", tone: "green", field: "Vật liệu", proposals: 3 },
  { id: "n2", title: "Cảm biến giám sát chất lượng nước thải", status: "Nháp", tone: "gray", field: "Cảm biến", proposals: 0 },
];

const FOCUSED_ITEMS = [
  { id: "r1", title: "Màng sinh học từ tinh bột sắn biến tính", authorName: "PGS. Trần Văn Hòa", authorSlug: "tran-van-hoa-2", orgName: "ĐH Bách Khoa", score: 0.91, source: "mang-sinh-hoc-tinh-bot-v2.pdf", locator: "tr. 11",
    abstract: "Nghiên cứu biến tính tinh bột sắn bằng phương pháp ester hóa để tạo màng sinh học có độ đàn hồi và khả năng kháng nước cao hơn tinh bột nguyên bản, hướng tới ứng dụng bao bì thực phẩm phân hủy sinh học." },
  { id: "r2", title: "Bao bì phân hủy từ bã mía ép nhiệt", authorName: "ThS. Ngô Bảo Châu", authorSlug: "ngo-bao-chau", orgName: "Viện Nông nghiệp", score: 0.86, source: "bao-bi-ba-mia.pdf", locator: "tr. 2",
    abstract: "Quy trình ép nhiệt bã mía thành khay đựng thực phẩm phân hủy hoàn toàn trong 60 ngày, không dùng chất kết dính hóa học, chi phí sản xuất cạnh tranh với khay xốp EPS hiện hành." },
];

const AUTHOR_PROFILE = {
  slug: "le-minh-anh",
  name: "TS. Lê Minh Anh",
  org: "Viện Công nghệ Sinh học",
  orgSlug: "vien-cong-nghe-sinh-hoc",
  verified: true,
  expertise: ["Vật liệu composite", "Năng lượng tái tạo", "Cảm biến sinh học"],
  orcid: "0000-0002-1825-0097",
  resources: [
    { title: "Vật liệu composite tái chế từ vỏ trấu", type: "Bài báo", year: 2024, abstract: "Nghiên cứu trình bày quy trình chế tạo vật liệu composite từ vỏ trấu tái chế, đạt độ bền kéo tương đương composite gốc dầu mỏ trong khi giảm 40% chi phí nguyên liệu." },
    { title: "Đặc tính cơ học của composite vỏ trấu", type: "Bài báo", year: 2023, abstract: "Khảo sát đặc tính cơ học của composite vỏ trấu ở các tỷ lệ phối trộn khác nhau, xác định tỷ lệ tối ưu cho độ bền kéo và độ bền uốn." },
    { title: "Dữ liệu quan trắc mực nước 2019-2024", type: "Bộ dữ liệu", year: 2024, abstract: null },
  ],
};

const ORG_PROFILE = {
  slug: "vien-cong-nghe-sinh-hoc",
  name: "Viện Công nghệ Sinh học",
  type: "Viện nghiên cứu",
  description: "Đơn vị nghiên cứu ứng dụng công nghệ sinh học trong nông nghiệp, vật liệu và môi trường, trực thuộc Viện Hàn lâm Khoa học và Công nghệ Việt Nam.",
  verified: true,
  authors: [
    { name: "TS. Lê Minh Anh", slug: "le-minh-anh", expertise: "Vật liệu composite" },
    { name: "PGS. Đỗ Thị Lan", slug: "do-thi-lan", expertise: "Công nghệ sinh học nông nghiệp" },
  ],
  resources: [
    { title: "Vật liệu composite tái chế từ vỏ trấu", type: "Bài báo", year: 2024, author: "TS. Lê Minh Anh" },
    { title: "Quy trình lên men sinh khối tảo", type: "Bài báo", year: 2023, author: "PGS. Đỗ Thị Lan" },
  ],
};

const PROPOSALS_RECEIVED = [
  { title: "Đề xuất quy trình xử lý nước thải bằng vi tảo", author: "ThS. Phạm Thu Trang", need: "Cảm biến giám sát chất lượng nước thải", status: "Chờ xem xét", tone: "blue" },
];

const MY_PROPOSALS = [
  { title: "Đề xuất màng sinh học chống ẩm cho bao bì", need: "Vật liệu phân hủy sinh học thay thế nhựa PE", status: "Chờ xem xét", tone: "blue" },
  { title: "Đề xuất cảm biến khí NH3 chi phí thấp", need: "Giám sát khí thải chuồng trại", status: "Đã chấp nhận", tone: "green" },
];

const INITIATIONS_RECEIVED = [
  { id: "ci1", resource: "Vật liệu composite tái chế từ vỏ trấu", company: "Công ty Nhựa sinh học Sông Hồng", message: "Chúng tôi quan tâm tới khả năng ứng dụng vào bao bì công nghiệp, mong được trao đổi thêm.", expiresIn: "12 ngày", source: "composite-vo-trau-v3.pdf", locator: "tr. 4" },
];

function Abstract({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  return (
    <p className={`mt-1.5 text-xs leading-relaxed text-slate-500 ${expanded ? "" : "line-clamp-2"}`}>
      {text}{" "}
      <button onClick={() => setExpanded((e) => !e)} className="font-medium text-indigo-700 hover:underline">
        {expanded ? "Thu gọn" : "Xem thêm"}
      </button>
    </p>
  );
}

function AuthorOrgLine({ authorName, authorSlug, orgName, orgSlug, openAuthor, openOrg }) {
  return (
    <p className="text-xs text-slate-500">
      <button onClick={() => openAuthor(authorSlug)} className="font-medium text-slate-700 hover:text-indigo-700 hover:underline">
        {authorName}
      </button>
      {orgName && (
        <>
          {" · "}
          <button onClick={() => openOrg(orgSlug)} className="hover:text-indigo-700 hover:underline">
            {orgName}
          </button>
        </>
      )}
    </p>
  );
}

/* ---------------------- FEED (FEED run — dựa company_profile) --------- */
function FeedPage({ openAuthor, openOrg }) {
  const [items, setItems] = useState(FEED_ITEMS);
  const [confirmId, setConfirmId] = useState(null);
  const [sentIds, setSentIds] = useState([]);
  const [loading, setLoading] = useState(false);

  const dismiss = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const refresh = () => {
    setLoading(true);
    setTimeout(() => { setItems(FEED_ITEMS); setLoading(false); }, 700);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Feed khám phá</h1>
          <p className="text-sm text-slate-500">Gợi ý dựa trên hồ sơ công ty của bạn — không cần khai báo nhu cầu cụ thể</p>
        </div>
        <PrimaryButton icon={Sparkles} onClick={refresh}>{loading ? "Đang làm mới..." : "Làm mới gợi ý"}</PrimaryButton>
      </div>

      <Card className="border-indigo-100 bg-indigo-50/40">
        <p className="text-xs text-slate-500">
          Feed dựa trên: <span className="font-medium text-slate-700">Ngành nông nghiệp - chế biến sinh học</span>
          {" · "}<button className="font-medium text-indigo-700 hover:underline">Chỉnh sửa hồ sơ công ty</button> để cải thiện gợi ý.
        </p>
      </Card>

      {items.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-slate-500">Không còn gợi ý nào mới. Thử làm mới sau, hoặc đăng 1 nhu cầu nghiên cứu cụ thể để tìm chính xác hơn.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{r.type} · {r.year}</span>
                <span className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-xs font-semibold text-indigo-700">{Math.round(r.score * 100)}%</span>
              </div>
              <p className="text-sm font-medium text-slate-900">{r.title}</p>
              <AuthorOrgLine authorName={r.authorName} authorSlug={r.authorSlug} orgName={r.orgName} orgSlug={r.orgSlug} openAuthor={openAuthor} openOrg={openOrg} />
              <Abstract text={r.abstract} />
              <div className="mt-2"><CitationChip source={r.source} locator={r.locator} /></div>
              <div className="mt-3 flex items-center justify-end gap-2">
                {sentIds.includes(r.id) ? (
                  <StatusPill tone="blue"><Send className="h-3 w-3" /> Đã gửi, chờ phản hồi</StatusPill>
                ) : confirmId === r.id ? (
                  <ConfirmInitiation
                    onCancel={() => setConfirmId(null)}
                    onSend={() => { setSentIds((s) => [...s, r.id]); setConfirmId(null); }}
                  />
                ) : (
                  <>
                    <GhostButton onClick={() => dismiss(r.id)}>Không quan tâm</GhostButton>
                    <PrimaryButton onClick={() => setConfirmId(r.id)}>Quan tâm</PrimaryButton>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmInitiation({ onSend, onCancel }) {
  return (
    <div className="w-full rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
      <p className="mb-2 text-xs font-medium text-slate-700">Gửi yêu cầu hợp tác tới tác giả</p>
      <textarea
        rows={2}
        placeholder="Lời nhắn ngắn (không bắt buộc)..."
        className="mb-2 w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <GhostButton onClick={onCancel}>Hủy</GhostButton>
        <PrimaryButton icon={Send} onClick={onSend}>Gửi yêu cầu</PrimaryButton>
      </div>
    </div>
  );
}

/* ---------------------- NHU CẦU NGHIÊN CỨU (research_need) ------------ */
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
              <th className="pb-2 font-medium">Lĩnh vực</th>
              <th className="pb-2 font-medium">Trạng thái</th>
              <th className="pb-2 font-medium">Đề xuất nhận được</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {NEEDS.map((n) => (
              <tr key={n.id} onClick={() => openNeed(n.id)} className="cursor-pointer hover:bg-slate-50">
                <td className="py-3 font-medium text-slate-900">{n.title}</td>
                <td className="py-3 text-slate-500">{n.field}</td>
                <td className="py-3"><StatusDot tone={n.tone} label={n.status} /></td>
                <td className="py-3 font-mono text-slate-500">{n.proposals}</td>
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
        <TextField label="Thời gian mong muốn (tháng)" type="number" placeholder="12" />
        <TextField label="Tiêu chí thành công" as="textarea" placeholder="Vd: chi phí sản xuất không vượt quá 120% so với hiện tại..." />
        <p className="text-xs text-slate-400">Nhu cầu sẽ ở trạng thái Nháp — cần bấm Đăng để mở cho tác giả nộp đề xuất và AI bắt đầu gợi ý theo đúng nhu cầu này.</p>
        <div className="flex gap-2">
          <GhostButton>Lưu nháp</GhostButton>
          <PrimaryButton>Đăng nhu cầu</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}

function NeedDetailPage({ needId, setPage, openAuthor, openOrg }) {
  const [tab, setTab] = useState("Mô tả");
  const n = NEEDS.find((x) => x.id === needId) || NEEDS[0];
  return (
    <div className="space-y-5">
      <BackLink onClick={() => setPage("needs")}>Quay lại danh sách nhu cầu</BackLink>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{n.title}</h1>
        <StatusDot tone={n.tone} label={n.status} />
      </div>
      <Tabs tabs={["Mô tả", "Đề xuất nhận được", "Gợi ý AI theo nhu cầu này"]} active={tab} onChange={setTab} />

      {tab === "Mô tả" && (
        <Card>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <dt className="text-xs text-slate-400">Vấn đề cần giải quyết</dt>
              <dd className="text-slate-700">Cần vật liệu bao bì phân hủy sinh học trong môi trường tự nhiên dưới 180 ngày, chi phí sản xuất không vượt quá 120% so với nhựa PE hiện dùng.</dd>
            </div>
            <div><dt className="text-xs text-slate-400">Lĩnh vực</dt><dd className="text-slate-900">{n.field}</dd></div>
            <div><dt className="text-xs text-slate-400">Thời gian mong muốn</dt><dd className="text-slate-900">12 tháng</dd></div>
          </dl>
        </Card>
      )}

      {tab === "Đề xuất nhận được" && (
        <Card>
          <div className="divide-y divide-slate-100">
            {PROPOSALS_RECEIVED.map((p) => (
              <div key={p.title} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500">{p.author}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot tone={p.tone} label={p.status} />
                  <GhostButton tone="red">Từ chối</GhostButton>
                  <GhostButton tone="green">Chấp nhận</GhostButton>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "Gợi ý AI theo nhu cầu này" && (
        <Card>
          <p className="mb-3 text-xs text-slate-400">Khác với Feed — gợi ý này match trực tiếp theo mô tả nhu cầu cụ thể ở trên, độ chính xác cao hơn.</p>
          <div className="space-y-3">
            {FOCUSED_ITEMS.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{r.title}</p>
                    <AuthorOrgLine authorName={r.authorName} authorSlug={r.authorSlug} orgName={r.orgName} openAuthor={openAuthor} openOrg={openOrg} />
                    <Abstract text={r.abstract} />
                  </div>
                  <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 font-mono text-xs font-semibold text-indigo-700">{Math.round(r.score * 100)}% phù hợp</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <CitationChip source={r.source} locator={r.locator} />
                  <div className="flex gap-2">
                    <GhostButton>Bỏ qua</GhostButton>
                    <PrimaryButton icon={Send}>Quan tâm</PrimaryButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function CompanyProfilePage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Hồ sơ công ty</h1>
      <Card className="space-y-4">
        <TextField label="Tên công ty" placeholder="Công ty Nhựa sinh học Sông Hồng" />
        <SelectField label="Ngành nghề" options={["Nông nghiệp - Chế biến sinh học", "Vật liệu - Hóa chất", "Năng lượng", "Điện tử - Cảm biến"]} />
        <SelectField label="Quy mô công ty" options={["Dưới 50 nhân sự", "50-200 nhân sự", "Trên 200 nhân sự"]} />
        <TextField label="Mô tả công ty" as="textarea" placeholder="Mô tả ngắn về lĩnh vực hoạt động, sản phẩm chính..." hint="Dùng để tạo Feed gợi ý — mô tả càng cụ thể, gợi ý càng chính xác." />
        <PrimaryButton>Lưu hồ sơ</PrimaryButton>
      </Card>
    </div>
  );
}

/* ---------------------- PHÍA TÁC GIẢ ----------------------------------- */
function ProposalsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Đề xuất của tôi</h1>
      <Card>
        <div className="divide-y divide-slate-100">
          {MY_PROPOSALS.map((p) => (
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

function InitiationsPage() {
  const [decided, setDecided] = useState({});

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Yêu cầu hợp tác nhận được</h1>
      <p className="text-sm text-slate-500">Doanh nghiệp quan tâm tới resource của bạn qua Feed hoặc gợi ý AI — cần bạn đồng ý mới tạo case.</p>
      <Card>
        <div className="space-y-3">
          {INITIATIONS_RECEIVED.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{r.company}</p>
                  <p className="text-xs text-slate-500">quan tâm tới: {r.resource}</p>
                </div>
                <span className="text-xs text-amber-600">Hết hạn sau {r.expiresIn}</span>
              </div>
              <p className="mb-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-600">&quot;{r.message}&quot;</p>
              <CitationChip source={r.source} locator={r.locator} />
              <div className="mt-3 flex items-center justify-end gap-2">
                {decided[r.id] ? (
                  <StatusPill tone={decided[r.id] === "accept" ? "green" : "red"}>
                    {decided[r.id] === "accept" ? "Đã đồng ý — case đã tạo" : "Đã từ chối"}
                  </StatusPill>
                ) : (
                  <>
                    <GhostButton tone="red" onClick={() => setDecided((d) => ({ ...d, [r.id]: "decline" }))}>Từ chối</GhostButton>
                    <PrimaryButton icon={CheckCircle2} onClick={() => setDecided((d) => ({ ...d, [r.id]: "accept" }))}>Đồng ý · Tạo case</PrimaryButton>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------------- HỒ SƠ CÔNG KHAI TÁC GIẢ ------------------------- */
function AuthorPublicProfilePage({ setPage, openOrg }) {
  const a = AUTHOR_PROFILE;
  return (
    <div className="max-w-2xl space-y-6">
      <BackLink onClick={() => setPage("feed")}>Quay lại Feed</BackLink>

      <Card>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-lg font-semibold text-indigo-700">
              {a.name.split(" ").slice(-2).map((w) => w[0]).join("")}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{a.name}</p>
              <button onClick={() => openOrg(a.orgSlug)} className="text-xs text-slate-500 hover:text-indigo-700 hover:underline">{a.org}</button>
              <p className="mt-1 font-mono text-xs text-slate-400">ORCID: {a.orcid}</p>
            </div>
          </div>
          {a.verified && <StatusPill tone="green"><UserCheck className="h-3 w-3" /> Đã xác minh</StatusPill>}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {a.expertise.map((t) => (
            <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{t}</span>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader title={`Tài nguyên đã đăng ký trên hệ thống (${a.resources.length})`} />
        <p className="mb-3 text-xs text-slate-400">Chỉ hiện tài nguyên công khai do tác giả này trực tiếp đăng ký trên R2M.</p>
        <div className="space-y-3">
          {a.resources.map((r) => (
            <div key={r.title} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">{r.title}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{r.type} · {r.year}</span>
              </div>
              <Abstract text={r.abstract} />
              <div className="mt-2 flex justify-end">
                <GhostButton icon={Send}>Quan tâm</GhostButton>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------------- HỒ SƠ CÔNG KHAI TỔ CHỨC ------------------------- */
function OrganizationPublicProfilePage({ setPage, openAuthor }) {
  const o = ORG_PROFILE;
  return (
    <div className="max-w-2xl space-y-6">
      <BackLink onClick={() => setPage("feed")}>Quay lại Feed</BackLink>

      <Card>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-indigo-50">
              <Building2 className="h-6 w-6 text-indigo-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{o.name}</p>
              <p className="text-xs text-slate-500">{o.type}</p>
            </div>
          </div>
          {o.verified && <StatusPill tone="green"><CheckCircle2 className="h-3 w-3" /> Đã xác minh</StatusPill>}
        </div>
        <p className="mt-4 text-sm text-slate-600">{o.description}</p>
      </Card>

      <Card>
        <SectionHeader title={`Tác giả thuộc tổ chức (${o.authors.length})`} />
        <div className="divide-y divide-slate-100">
          {o.authors.map((au) => (
            <button key={au.slug} onClick={() => openAuthor(au.slug)} className="flex w-full items-center justify-between py-2.5 text-left hover:bg-slate-50">
              <span className="flex items-center gap-2 text-sm text-slate-900">
                <span className="h-6 w-6 rounded-full bg-slate-200" /> {au.name}
              </span>
              <span className="text-xs text-slate-400">{au.expertise}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader title={`Tài nguyên công khai (${o.resources.length})`} />
        <div className="space-y-2">
          {o.resources.map((r) => (
            <div key={r.title} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{r.title}</p>
                <p className="text-xs text-slate-500">{r.author} · {r.year}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{r.type}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------------- ROOT -------------------------------------------- */
export default function Phase5DiscoveryApp() {
  const [persona, setPersona] = useState("company");
  const [page, setPage] = useState("feed");
  const [activeNeed, setActiveNeed] = useState(null);

  const openNeed = (id) => { setActiveNeed(id); setPage("need-detail"); };
  const openAuthor = () => setPage("author-profile");
  const openOrg = () => setPage("org-profile");

  const nav = persona === "company" ? NAV_COMPANY : NAV_AUTHOR;
  const navPage = ["need-new", "need-detail"].includes(page) ? "needs"
    : ["author-profile", "org-profile"].includes(page) ? "feed"
    : page;

  return (
    <div className="min-h-[760px] w-full bg-slate-50 font-sans text-slate-900">
      <div className="flex items-center justify-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <span className="mr-2 text-xs text-slate-400">Xem thử với vai trò:</span>
        {PERSONAS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setPersona(p.key); setPage(p.key === "company" ? "feed" : "proposals"); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              persona === p.key ? "bg-indigo-700 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex">
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-white px-3 py-5">
          <div className="mb-6 flex items-center gap-2 px-2">
            <BrandMark />
            <span className="text-sm font-semibold text-slate-900">R2M · Phase 5</span>
          </div>
          <nav className="space-y-0.5">
            {nav.map((item) => (
              <button key={item.label} onClick={() => setPage(item.page)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
                  navPage === item.page ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-50"
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
            <Bell className="h-4.5 w-4.5 text-slate-400" />
          </div>
          <main className="px-6 py-6">
            {persona === "company" && page === "feed" && <FeedPage openAuthor={openAuthor} openOrg={openOrg} />}
            {persona === "company" && page === "needs" && <NeedsPage setPage={setPage} openNeed={openNeed} />}
            {persona === "company" && page === "need-new" && <NeedNewPage setPage={setPage} />}
            {persona === "company" && page === "need-detail" && <NeedDetailPage needId={activeNeed} setPage={setPage} openAuthor={openAuthor} openOrg={openOrg} />}
            {persona === "company" && page === "company-profile" && <CompanyProfilePage />}
            {persona === "company" && page === "author-profile" && <AuthorPublicProfilePage setPage={setPage} openOrg={openOrg} />}
            {persona === "company" && page === "org-profile" && <OrganizationPublicProfilePage setPage={setPage} openAuthor={openAuthor} />}
            {persona === "author" && page === "proposals" && <ProposalsPage />}
            {persona === "author" && page === "initiations" && <InitiationsPage />}
          </main>
        </div>
      </div>
    </div>
  );
}
