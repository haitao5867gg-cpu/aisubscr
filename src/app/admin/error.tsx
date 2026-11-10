"use client";

import { ErrorState } from "@/components/ErrorState";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reset={reset} />;
}
