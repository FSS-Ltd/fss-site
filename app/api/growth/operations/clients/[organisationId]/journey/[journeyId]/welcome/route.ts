import { founderWelcomeDownloadRoute } from "@/lib/operations/onboarding/route";
import { retiredGrowthOperationsResponse } from "@/lib/operations/auth/legacy-growth-route";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ organisationId: string; journeyId: string }> },
): Promise<Response> {
  const retired = retiredGrowthOperationsResponse();
  if (retired) return retired;
  const { organisationId, journeyId } = await context.params;
  return founderWelcomeDownloadRoute()(organisationId, journeyId);
}
