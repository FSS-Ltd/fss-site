import { founderSigningRoute } from "@/lib/operations/agreements/signing-route";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  return founderSigningRoute()(request, (await context.params).organisationId);
}
