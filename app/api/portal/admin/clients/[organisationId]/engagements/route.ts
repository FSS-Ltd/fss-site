import { staffEngagementRoute } from "@/lib/operations/http/staff-engagement-route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  return staffEngagementRoute()(request, (await context.params).organisationId);
}
