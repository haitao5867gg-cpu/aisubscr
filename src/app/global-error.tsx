"use client";

import Link from "next/link";
import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="container" style={{ padding: "4rem 1rem" }}>
          <div className="card empty-state" role="alert">
            <p className="eyebrow" style={{ margin: 0 }}>
              500
            </p>
            <h1 className="page-title">页面暂时打不开</h1>
            <p className="muted">请稍后再试。如果一直失败，把网址发给客服。</p>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={() => reset()}>
                重试
              </button>
              <Link href="/" className="btn btn-secondary">
                首页
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
