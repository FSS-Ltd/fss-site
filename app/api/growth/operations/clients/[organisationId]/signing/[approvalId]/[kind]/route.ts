import { founderSigningDownloadRoute } from "@/lib/operations/agreements/signing-route";
import { retiredGrowthOperationsResponse } from "@/lib/operations/auth/legacy-growth-route";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: {
    params: Promise<{
      organisationId: string;
      approvalId: string;
      kind: string;
    }>;
  },
): Promise<Response> {
  const retired = retiredGrowthOperationsResponse();
  if (retired) return retired;
  const { organisationId, approvalId, kind } = await context.params;
  return founderSigningDownloadRoute()(
    request,
    organisationId,
    approvalId,
    kind,
  );
}
