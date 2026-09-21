import { staffSettingsRoute } from "@/lib/operations/http/staff-settings-route";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return staffSettingsRoute()(request);
}
