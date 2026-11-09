"use client";

import { useState } from "react";
import Link from "next/link";
import { zh } from "@/i18n/zh";

export function SupportFab({ supportEmail, supportHours }: { supportEmail: string; supportHours: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="fab-support" aria-label={zh.ticket.fab} onClick={() => setOpen((v) => !v)}>
        💬
      </button>
      {open && (
        <div className="fab-panel stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{zh.ticket.fab}</strong>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            {zh.ticket.fabHint}
          </p>
          <div className="muted" style={{ fontSize: "0.9rem" }}>
            {zh.support.email}：
            <a href={`mailto:${supportEmail}`} style={{ color: "var(--primary)" }}>
              {supportEmail}
            </a>
            <br />
            {zh.support.hours}：{supportHours}
          </div>
          <div className="row">
            <Link href="/tickets" className="btn btn-primary" onClick={() => setOpen(false)}>
              {zh.nav.tickets}
            </Link>
            <Link href="/orders" className="btn btn-secondary" onClick={() => setOpen(false)}>
              {zh.nav.orders}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
