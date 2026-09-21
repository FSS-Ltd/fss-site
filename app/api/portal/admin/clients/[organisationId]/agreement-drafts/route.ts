import { staffAgreementDraftRoute } from "@/lib/operations/http/staff-agreement-draft-route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  return staffAgreementDraftRoute()(
    request,
    (await context.params).organisationId,
  );
}
