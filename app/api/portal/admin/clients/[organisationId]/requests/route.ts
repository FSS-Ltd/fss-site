import { staffRequestCreateRoute } from "@/lib/operations/http/staff-request-create-route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  return staffRequestCreateRoute()(request, (await context.params).organisationId);
}
