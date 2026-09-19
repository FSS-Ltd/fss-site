import { staffAgreementRoute } from "@/lib/operations/http/staff-agreement-route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  return staffAgreementRoute()(request, (await context.params).organisationId);
}
