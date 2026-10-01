import { staffClientCurrencyRoute } from "@/lib/operations/http/staff-client-currency-route";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  const { organisationId } = await params;
  return staffClientCurrencyRoute(organisationId)(request);
}
