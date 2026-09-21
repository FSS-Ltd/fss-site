import { staffOnboardingWorkspaceRoute } from "@/lib/operations/onboarding/route";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const organisationId = new URL(request.url).searchParams.get("organisationId") ?? "";
  return staffOnboardingWorkspaceRoute()(request, organisationId);
}
