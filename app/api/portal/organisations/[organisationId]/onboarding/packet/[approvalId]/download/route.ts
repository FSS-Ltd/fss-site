import { portalWelcomePacketDownloadRoute } from "@/lib/operations/onboarding/client-packet-http";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ organisationId: string; approvalId: string }> },
): Promise<Response> {
  const { organisationId, approvalId } = await context.params;
  return portalWelcomePacketDownloadRoute()(organisationId, approvalId);
}
