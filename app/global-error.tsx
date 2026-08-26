"use client";

import Link from "next/link";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, background: "#fff8e9", color: "#172d29", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: "2rem" }}>
          <section style={{ maxWidth: "36rem", borderTop: "1px solid #254a4240", borderBottom: "1px solid #254a4240", padding: "2.5rem 0" }}>
            <p style={{ color: "#a23b2c", fontSize: "0.875rem" }}>暂时中断</p>
            <h1 style={{ margin: "0.75rem 0 0", fontFamily: "Georgia, serif", fontSize: "1.875rem" }}>页面暂时无法打开</h1>
            <p style={{ margin: "1rem 0 0", color: "#45554f", lineHeight: 1.75 }}>请重新尝试，或回到首页继续浏览。</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.75rem" }}>
              <button type="button" onClick={retry} style={{ border: "1px solid #254a42", background: "transparent", color: "#254a42", cursor: "pointer", padding: "0.5rem 1rem" }}>
                再试一次
              </button>
              <Link href="/" style={{ border: "1px solid #254a4259", color: "#254a42", padding: "0.5rem 1rem", textDecoration: "none" }}>
                返回首页
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
