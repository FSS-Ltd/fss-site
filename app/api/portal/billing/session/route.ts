import { portalBillingRoute } from "@/lib/operations/http/portal-billing-route";
export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  return portalBillingRoute()(request);
}
