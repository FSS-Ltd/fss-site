import { portalRequestRoute } from "@/lib/operations/http/portal-request-route";
export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  return portalRequestRoute("create")(request);
}
