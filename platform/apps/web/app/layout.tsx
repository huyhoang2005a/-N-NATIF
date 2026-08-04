import type { ReactNode } from "react";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin", "vietnamese"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata = {
  title: "R2M — Nghiên cứu đến thị trường",
  description: "Sổ đăng ký cho các tổ chức nghiên cứu, doanh nghiệp và cơ quan nhà nước trên R2M.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
