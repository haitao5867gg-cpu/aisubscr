"use client";

import { useDict } from "@/components/LocaleProvider";

export default function ShopError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useDict();
  return (
    <div className="card empty-state" role="alert">
      <h1 className="page-title">{t.common.errorTitle}</h1>
      <p className="muted">{t.common.errorBody}</p>
      <button type="button" className="btn btn-primary" onClick={() => reset()}>
        {t.common.retry}
      </button>
    </div>
  );
}
