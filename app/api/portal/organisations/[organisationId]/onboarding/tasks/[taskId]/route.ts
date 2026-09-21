import { portalOnboardingTaskRoute } from "@/lib/operations/onboarding/client-workspace-http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string; taskId: string }> },
): Promise<Response> {
  const { organisationId, taskId } = await context.params;
  return portalOnboardingTaskRoute()(request, organisationId, taskId);
}
