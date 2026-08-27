import { timingSafeEqual } from "node:crypto";

export type CronAuthorizationResult =
  | { authorized: true }
  | {
      authorized: false;
      reason: "missing_secret" | "missing_header" | "invalid_secret";
    };

export function authorizeCronRequest(
  request: Request,
  cronSecret: string | undefined,
): CronAuthorizationResult {
  if (!cronSecret || !cronSecret.trim()) {
    return { authorized: false, reason: "missing_secret" };
  }

  const header = request.headers.get("authorization");
  if (!header) {
    return { authorized: false, reason: "missing_header" };
  }

  const expected = `Bearer ${cronSecret}`;
  const headerBuffer = Buffer.from(header, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const matches =
    headerBuffer.length === expectedBuffer.length &&
    timingSafeEqual(headerBuffer, expectedBuffer);

  return matches
    ? { authorized: true }
    : { authorized: false, reason: "invalid_secret" };
}

export type CronRouteConfig = {
  cronSecret: string | undefined;
  automationsEnabled: boolean;
  disabledReason?: string;
  reportUnexpectedError?: (error: unknown) => void;
};

export function createCronRouteHandler<T extends object>(
  config: CronRouteConfig,
  work: () => Promise<T>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const authResult = authorizeCronRequest(request, config.cronSecret);
    if (!authResult.authorized) {
      return Response.json(
        { ok: false, code: authResult.reason },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }

    if (!config.automationsEnabled) {
      return Response.json(
        {
          ok: true,
          skipped: config.disabledReason ?? "automations_disabled",
        },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }

    try {
      const result = await work();
      return Response.json(
        { ok: true, ...result },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    } catch (error) {
      config.reportUnexpectedError?.(error);
      return Response.json(
        { ok: false, code: "internal_error" },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }
  };
}
