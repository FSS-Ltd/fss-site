import { staffProjectRoute } from "@/lib/operations/http/staff-project-route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  return staffProjectRoute()(request, (await context.params).projectId);
}
