import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vibe Hackathon 2026",
  description: "Vibe Coding 竞赛协作工作区",
};

import { Toaster } from "sonner"; // 1. 引入 Toaster

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" /> {/* 2. 挂载在 body 底部 */}
      </body>
    </html>
  );
}
