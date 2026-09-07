import { portalRequestRoute } from "@/lib/operations/http/portal-request-route";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
): Promise<Response> {
  return portalRequestRoute("update")(
    request,
    (await context.params).requestId,
  );
}
