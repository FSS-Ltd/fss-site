import { staffWelcomePackRoute } from "@/lib/operations/http/staff-welcome-pack-route";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return staffWelcomePackRoute()(request);
}
