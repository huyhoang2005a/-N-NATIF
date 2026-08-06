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
   ĐĂNG NHẬP / ĐĂNG KÝ — R2M UI demo (dữ liệu minh họa, chưa nối API thật)
   Trang: Đăng nhập · Đăng ký (2 bước: thông tin cơ bản → chọn mục đích)
   ====================================================================== */

function LoginPage({ onLogin, onGoRegister }) {
  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-8 flex flex-col items-center gap-3">
        <BrandMark size="lg" />
        <div className="text-center">
          <p className="text-base font-semibold text-slate-900">R2M Platform</p>
          <p className="text-xs text-slate-500">Kết nối nghiên cứu với thương mại hóa</p>
        </div>
      </div>

      <Card>
        <h1 className="mb-1 text-base font-semibold text-slate-900">Đăng nhập</h1>
        <p className="mb-5 text-xs text-slate-500">Nhập thông tin tài khoản để tiếp tục.</p>

        <div className="space-y-3.5">
          <TextField label="Email" type="email" placeholder="ban@toChuc.vn" icon={Mail} />
          <TextField label="Mật khẩu" type="password" placeholder="••••••••" icon={Lock} />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <label className="flex items-center gap-1.5 text-slate-500">
            <input type="checkbox" className="rounded border-slate-300" />
            Ghi nhớ đăng nhập
          </label>
          <a className="font-medium text-indigo-700 hover:text-indigo-800" href="#">Quên mật khẩu?</a>
        </div>

        <div className="mt-5">
          <PrimaryButton full onClick={onLogin}>Đăng nhập</PrimaryButton>
        </div>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-100" />
          <span className="text-xs text-slate-400">hoặc</span>
          <span className="h-px flex-1 bg-slate-100" />
        </div>

        <button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">
          Đăng nhập bằng email tổ chức (SSO)
        </button>
      </Card>

      <p className="mt-5 text-center text-xs text-slate-500">
        Chưa có tài khoản?{" "}
        <button onClick={onGoRegister} className="font-medium text-indigo-700 hover:text-indigo-800">
          Đăng ký
        </button>
      </p>
    </div>
  );
}

function RegisterPage({ onRegister, onGoLogin }) {
  const [step, setStep] = useState(1);
  const [intent, setIntent] = useState(null); // "org" | "author"

  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-8 flex flex-col items-center gap-3">
        <BrandMark size="lg" />
        <div className="text-center">
          <p className="text-base font-semibold text-slate-900">Tạo tài khoản R2M</p>
          <p className="text-xs text-slate-500">Bước {step}/2</p>
        </div>
      </div>

      <Card>
        {step === 1 && (
          <>
            <h1 className="mb-1 text-base font-semibold text-slate-900">Thông tin tài khoản</h1>
            <p className="mb-5 text-xs text-slate-500">Dùng email công việc để xác minh nhanh hơn.</p>
            <div className="space-y-3.5">
              <TextField label="Họ và tên" placeholder="Nguyễn Văn A" icon={User} />
              <TextField label="Email" type="email" placeholder="ban@toChuc.vn" icon={Mail} />
              <TextField label="Mật khẩu" type="password" placeholder="Tối thiểu 8 ký tự" icon={Lock} />
              <TextField label="Xác nhận mật khẩu" type="password" placeholder="Nhập lại mật khẩu" icon={Lock} />
            </div>
            <label className="mt-3 flex items-start gap-2 text-xs text-slate-500">
              <input type="checkbox" className="mt-0.5 rounded border-slate-300" />
              Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật của R2M.
            </label>
            <div className="mt-5">
              <PrimaryButton full onClick={() => setStep(2)}>Tiếp tục</PrimaryButton>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <BackLink onClick={() => setStep(1)}>Quay lại thông tin tài khoản</BackLink>
            <h1 className="mb-1 text-base font-semibold text-slate-900">Bạn tham gia R2M với vai trò nào?</h1>
            <p className="mb-5 text-xs text-slate-500">Có thể mở rộng thêm vai trò khác sau khi được xác minh.</p>

            <div className="space-y-2.5">
              <button
                onClick={() => setIntent("org")}
                className={`flex w-full items-start gap-3 rounded-lg border p-3.5 text-left ${
                  intent === "org" ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Building2 className={`mt-0.5 h-5 w-5 ${intent === "org" ? "text-indigo-700" : "text-slate-400"}`} />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Tổ chức nghiên cứu / Doanh nghiệp</span>
                  <span className="block text-xs text-slate-500">Tạo tổ chức mới, bạn sẽ là chủ sở hữu — cần xác minh tổ chức trước khi hoạt động.</span>
                </span>
              </button>

              <button
                onClick={() => setIntent("author")}
                className={`flex w-full items-start gap-3 rounded-lg border p-3.5 text-left ${
                  intent === "author" ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <FlaskConical className={`mt-0.5 h-5 w-5 ${intent === "author" ? "text-indigo-700" : "text-slate-400"}`} />
                <span>
                  <span className="block text-sm font-medium text-slate-900">Tác giả độc lập</span>
                  <span className="block text-xs text-slate-500">Nộp hồ sơ xác minh danh tính cá nhân để đăng tài nguyên nghiên cứu và tạo case.</span>
                </span>
              </button>
            </div>

            {intent === "org" && (
              <div className="mt-4 space-y-3.5 border-t border-slate-100 pt-4">
                <TextField label="Tên tổ chức" placeholder="Viện Công nghệ Sinh học" icon={Building2} />
                <SelectField label="Loại tổ chức" options={["Viện / Trường nghiên cứu", "Doanh nghiệp", "Tổ chức trung gian"]} />
                <TextField label="Tên miền email tổ chức" placeholder="toChuc.vn" icon={Globe} hint="Dùng để tự động khớp thành viên đăng ký cùng tổ chức." />
              </div>
            )}
            {intent === "author" && (
              <div className="mt-4 space-y-3.5 border-t border-slate-100 pt-4">
                <TextField label="Đơn vị công tác hiện tại" placeholder="Viện Công nghệ Sinh học" icon={Building2} />
                <TextField label="Lĩnh vực chuyên môn" placeholder="Vật liệu composite, năng lượng tái tạo" icon={FlaskConical} />
                <TextField label="ORCID (không bắt buộc)" placeholder="0000-0002-1825-0097" icon={FileText} />
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <div className="flex-1">
                <PrimaryButton full onClick={onRegister}>Hoàn tất đăng ký</PrimaryButton>
              </div>
            </div>
            {intent && (
              <p className="mt-3 text-center text-xs text-slate-400">
                Sau khi đăng ký, {intent === "org" ? "tổ chức" : "hồ sơ"} của bạn sẽ ở trạng thái chờ xác minh.
              </p>
            )}
          </>
        )}
      </Card>

      <p className="mt-5 text-center text-xs text-slate-500">
        Đã có tài khoản?{" "}
        <button onClick={onGoLogin} className="font-medium text-indigo-700 hover:text-indigo-800">
          Đăng nhập
        </button>
      </p>
    </div>
  );
}

export default function AuthApp() {
  const [screen, setScreen] = useState("login"); // "login" | "register"

  return (
    <div className="flex min-h-[760px] w-full items-center justify-center bg-slate-50 px-4 py-10 font-sans text-slate-900">
      {screen === "login" ? (
        <LoginPage onLogin={() => {}} onGoRegister={() => setScreen("register")} />
      ) : (
        <RegisterPage onRegister={() => {}} onGoLogin={() => setScreen("login")} />
      )}
    </div>
  );
}
