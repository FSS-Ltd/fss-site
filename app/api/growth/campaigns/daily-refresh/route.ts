import { requireFounder } from "@/lib/growth/auth/require-founder";
import { createCampaignDailyRefreshHandler } from "@/lib/growth/dashboard/campaign-daily-refresh-route";
import { readMessageActionRouteConfig } from "../../runtime";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  try {
    return await createCampaignDailyRefreshHandler({
      origin: readMessageActionRouteConfig().origin,
      authorizeFounder: requireFounder,
    })(request);
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
