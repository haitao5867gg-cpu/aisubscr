import { logApiError, requestIdFrom } from "@/lib/server-log";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureSqlitePragmas } = await import("@/lib/db");
    await ensureSqlitePragmas();
  }
}

type RequestErrorContext = {
  routerKind: "Pages Router" | "App Router";
  routePath: string;
  routeType: "render" | "route" | "action" | "middleware";
};

/**
 * Next calls this when a route handler throws. Caught responses log themselves.
 * Page renders are left to error.tsx so the journal stays focused on API failures.
 */
export async function onRequestError(
  error: unknown,
  request: Readonly<{ path: string; method: string; headers: NodeJS.Dict<string | string[]> }>,
  context: Readonly<RequestErrorContext>,
) {
  if (context.routeType !== "route") return;
  logApiError({
    requestId: requestIdFrom(request.headers),
    route: context.routePath || request.path,
    status: 500,
    error,
  });
}
