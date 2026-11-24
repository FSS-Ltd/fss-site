import { requireFounder } from "@/lib/growth/auth/require-founder";
import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { createGrowthEventHandler } from "@/lib/growth/facebook/event-route-handler";
import { readFacebookEventUrl } from "@/lib/growth/facebook/events";
import { growthStreamDeadline } from "@/lib/growth/facebook/session-deadline";
import { readMessageActionRouteConfig } from "../runtime";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  try {
    return await createGrowthEventHandler({
      origin: readMessageActionRouteConfig().origin,
      authorizeFounder: requireFounder,
      deadline: (req) =>
        growthStreamDeadline(req, readGrowthServerEnv().authSecret),
      eventUrl: readFacebookEventUrl,
    })(request);
  } catch {
    return new Response(null, { status: 503 });
  }
}
