import { staffClientRoute } from "@/lib/operations/http/staff-client-route";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return staffClientRoute()(request);
}
