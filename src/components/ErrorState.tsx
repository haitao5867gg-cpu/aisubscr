"use client";

import Link from "next/link";
import { useDict } from "./LocaleProvider";

export function ErrorState({ reset }: { reset: () => void }) {
  const t = useDict();
  return (
    <div className="card empty-state" role="alert">
      <p className="eyebrow" style={{ margin: 0 }}>
        500
      </p>
      <h1 className="page-title">{t.common.errorTitle}</h1>
      <p className="muted">{t.common.errorBody}</p>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          {t.common.retry}
        </button>
        <Link href="/" className="btn btn-secondary">
          {t.nav.home}
        </Link>
      </div>
    </div>
  );
}
