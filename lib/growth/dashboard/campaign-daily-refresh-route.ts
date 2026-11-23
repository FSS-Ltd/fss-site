import {
  FounderAuthorizationError,
  type FounderSession,
} from "../auth/require-founder";
import { requireCampaignFounder } from "../campaigns/authorization";
import {
  getCampaignDailySummary,
  type CampaignDailySummaryResult,
} from "./campaign-daily-summary";
import { readRequestHasRegisteredOrigin } from "../http/founder-request";

export function createCampaignDailyRefreshHandler(deps: {
  origin: string;
  authorizeFounder: () => Promise<FounderSession>;
  read?: (founder: FounderSession) => Promise<CampaignDailySummaryResult>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      if (!readRequestHasRegisteredOrigin(request, deps.origin))
        return new Response(null, {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        });
      const founder = await deps.authorizeFounder();
      requireCampaignFounder(founder);
      const result = await (deps.read ?? getCampaignDailySummary)(founder);
      return Response.json(result, {
        status: result.status === "unavailable" ? 503 : 200,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      const unauthorized =
        error instanceof FounderAuthorizationError ||
        (error instanceof Error &&
          error.message === "founder_authorization_required");
      return new Response(null, {
        status: unauthorized ? 401 : 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
  };
}
