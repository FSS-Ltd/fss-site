import { staffProjectCreateRoute } from "@/lib/operations/http/staff-project-create-route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  return staffProjectCreateRoute()(
    request,
    (await context.params).organisationId,
  );
}
