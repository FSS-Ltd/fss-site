import { founderJourneyRoute } from "@/lib/operations/onboarding/route";
import { retiredGrowthOperationsResponse } from "@/lib/operations/auth/legacy-growth-route";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  const retired = retiredGrowthOperationsResponse();
  if (retired) return retired;
  return founderJourneyRoute()(request, (await context.params).organisationId);
}
