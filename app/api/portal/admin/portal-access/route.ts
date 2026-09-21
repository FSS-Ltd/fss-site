import { staffPortalAccessRoute } from "@/lib/operations/http/staff-portal-access-route";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return staffPortalAccessRoute()(request);
}
