import { founderSigningRoute } from "@/lib/operations/agreements/signing-route";
import { retiredGrowthOperationsResponse } from "@/lib/operations/auth/legacy-growth-route";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  const retired = retiredGrowthOperationsResponse();
  if (retired) return retired;
  return founderSigningRoute()(request, (await context.params).organisationId);
}
