import { staffSigningRoute } from "@/lib/operations/agreements/signing-route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  return staffSigningRoute()(request, (await context.params).organisationId);
}
