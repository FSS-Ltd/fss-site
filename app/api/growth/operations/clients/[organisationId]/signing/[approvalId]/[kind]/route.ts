import { founderSigningDownloadRoute } from "@/lib/operations/agreements/signing-route";
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
  const { organisationId, approvalId, kind } = await context.params;
  return founderSigningDownloadRoute()(
    request,
    organisationId,
    approvalId,
    kind,
  );
}
