"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/components/LocaleProvider";

export function OrderCountdown({ expiresAt }: { expiresAt: string }) {
  const t = useDict();
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const refreshed = useRef(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (now == null || refreshed.current) return;
    if (new Date(expiresAt).getTime() <= now) {
      refreshed.current = true;
      router.refresh();
    }
  }, [now, expiresAt, router]);

  if (now == null) {
    return (
      <div className="alert alert-warn" role="timer">
        {t.order.countdown.replace("{time}", "…")}
      </div>
    );
  }
  const remain = new Date(expiresAt).getTime() - now;
  if (remain <= 0) {
    return (
      <div className="alert alert-warn" role="status">
        {t.order.countdownDone}
      </div>
    );
  }
  const totalSeconds = Math.ceil(remain / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const time = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return (
    <div className="alert alert-warn" role="timer">
      {t.order.countdown.replace("{time}", time)}
    </div>
  );
}
