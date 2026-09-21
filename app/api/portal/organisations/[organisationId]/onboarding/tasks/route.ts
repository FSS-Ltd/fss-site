import { portalOnboardingTaskRoute } from "@/lib/operations/onboarding/client-workspace-http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  return portalOnboardingTaskRoute()(request, (await context.params).organisationId);
}
