import { founderJourneyRoute } from "@/lib/operations/onboarding/route";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  return founderJourneyRoute()(request, (await context.params).organisationId);
}
