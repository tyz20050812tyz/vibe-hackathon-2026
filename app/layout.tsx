import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "书外之遇",
  description: "一间供意外发现发生的数字图书馆。",
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
