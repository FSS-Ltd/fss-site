import {
  FounderAuthorizationError,
  type FounderSession,
} from "@/lib/growth/auth/require-founder";
import type { GrowthReleaseHealth } from "@/lib/growth/health/checks";

export type HealthRouteDependencies = {
  authorizeFounder: () => Promise<FounderSession>;
  buildReport: () => Promise<GrowthReleaseHealth>;
  reportUnexpectedError?: (error: unknown) => void;
};

export function createHealthRouteHandler(
  dependencies: HealthRouteDependencies,
): (request: Request) => Promise<Response> {
  return async () => {
    try {
      await dependencies.authorizeFounder();
    } catch (error) {
      if (error instanceof FounderAuthorizationError) {
        return Response.json(
          { ok: false, code: "unauthorized" },
          { status: 401, headers: { "cache-control": "no-store" } },
        );
      }
      throw error;
    }

    try {
      const report = await dependencies.buildReport();
      return Response.json(
        { ok: true, report },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    } catch (error) {
      dependencies.reportUnexpectedError?.(error);
      return Response.json(
        { ok: false, code: "internal_error" },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }
  };
}
