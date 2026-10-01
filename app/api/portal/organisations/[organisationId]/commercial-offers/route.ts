import { portalCommercialOfferRoute } from "@/lib/operations/http/commercial-offer-route";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  const { organisationId } = await context.params;
  return portalCommercialOfferRoute()(request, organisationId);
}
