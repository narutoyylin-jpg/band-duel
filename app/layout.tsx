import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "半導體異質接面｜能帶互動實驗",
  description: "自由探索能帶、Shuffle 對戰與雙人秘密出招。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
