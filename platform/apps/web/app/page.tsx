import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px" }}>
      <h1>R2M V5</h1>
      <p>Phase 1: Identity &amp; Organization, Verification.</p>
      <p>
        <Link href="/login">Đăng nhập</Link> · <Link href="/register-organization">Đăng ký tổ chức</Link>
      </p>
    </main>
  );
}
