import type { ReactNode } from "react";

export const metadata = {
  title: "R2M — Research to Market",
  description: "Research-to-Market platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
