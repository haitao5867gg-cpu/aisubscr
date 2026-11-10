"use client";

import { ErrorState } from "@/components/ErrorState";

export default function ShopError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState reset={reset} />;
}
