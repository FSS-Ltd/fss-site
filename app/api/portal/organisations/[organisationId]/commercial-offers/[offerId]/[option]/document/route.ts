import { downloadPortalCommercialOfferDocument } from "@/lib/operations/http/commercial-offer-download-route";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      organisationId: string;
      offerId: string;
      option: string;
    }>;
  },
): Promise<Response> {
  const { organisationId, offerId, option } = await context.params;
  return downloadPortalCommercialOfferDocument(organisationId, offerId, option);
}
