import { timingSafeEqual } from "node:crypto";

export type CronAuthorizationResult =
  | { authorized: true }
  | {
      authorized: false;
      reason: "missing_secret" | "missing_header" | "invalid_secret";
    };

export type CronErrorReport = {
  errorName: string;
  errorCode?: string;
};

const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9]{0,79}$/;
const SAFE_ERROR_CODES = new Set([
  "AUTHENTICATION_FAILED",
  "HISTORY_ID_EXPIRED",
  "INVALID_PROVIDER_RESPONSE",
  "PERMANENT_PROVIDER_ERROR",
  "REJECTED_CATEGORY",
  "RETRYABLE_PROVIDER_ERROR",
]);

function readErrorString(error: unknown, property: "name" | "code"): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  try {
    const value = Reflect.get(error, property);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function toCronErrorReport(error: unknown): CronErrorReport {
  const errorName = readErrorString(error, "name");
  const errorCode = readErrorString(error, "code");

  return {
    errorName:
      errorName && SAFE_ERROR_NAME.test(errorName) ? errorName : "UnknownError",
    ...(errorCode && SAFE_ERROR_CODES.has(errorCode) ? { errorCode } : {}),
  };
}

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
  reportUnexpectedError?: (report: CronErrorReport) => void;
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
      config.reportUnexpectedError?.(toCronErrorReport(error));
      return Response.json(
        { ok: false, code: "internal_error" },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }
  };
}
