"use client";

import { ErrorState } from "@/components/ErrorState";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container" style={{ padding: "4rem 1rem" }}>
      <ErrorState reset={reset} />
    </main>
  );
}
