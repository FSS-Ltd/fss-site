import { staffWelcomeDownloadRoute } from "@/lib/operations/onboarding/route";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ organisationId: string; journeyId: string }> },
): Promise<Response> {
  const { organisationId, journeyId } = await context.params;
  return staffWelcomeDownloadRoute()(organisationId, journeyId);
}
