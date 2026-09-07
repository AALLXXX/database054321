import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alex Database",
  description: "Database token bot Telegram — aman, realtime, multi-role.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
