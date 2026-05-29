import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Health OS — AI 健康管理系统",
  description: "把营养、运动、睡眠、断食、动力整合在一起的 AI 健康 App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {/* Global nav — minimal, stays out of the way */}
        <nav className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <a
            href="/"
            className="px-4 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur text-white/60 hover:text-white hover:bg-white/10 text-sm transition"
          >
            首页
          </a>
          <a
            href="/history"
            className="px-4 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur text-white/60 hover:text-white hover:bg-white/10 text-sm transition"
          >
            历史方案
          </a>
          <a
            href="/inbody"
            className="px-4 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur text-white/60 hover:text-white hover:bg-white/10 text-sm transition"
          >
            InBody OS
          </a>
        </nav>

        {children}
      </body>
    </html>
  );
}
