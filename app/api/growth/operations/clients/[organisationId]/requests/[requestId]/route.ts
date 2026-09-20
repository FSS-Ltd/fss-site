import { randomUUID } from "node:crypto";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { executeFounderRequestCommand } from "@/lib/operations/requests/service";
import { createFounderRequestHandler } from "@/lib/operations/http/founder-request-handler";
import { retiredGrowthOperationsResponse } from "@/lib/operations/auth/legacy-growth-route";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string; requestId: string }> },
): Promise<Response> {
  const retired = retiredGrowthOperationsResponse();
  if (retired) return retired;
  const { organisationId, requestId } = await context.params;
  return createFounderRequestHandler({
    enabled: operationsEnabled(),
    origin: new URL(resolveSiteUrl()).origin,
    authorizeFounder: requireFounder,
    execute: (founder, organisation, command, correlationId) =>
      executeFounderRequestCommand(
        getOperationsDb(),
        founder,
        organisation,
        command,
        correlationId,
      ),
    createCorrelationId: randomUUID,
    reportUnexpectedError: (report) =>
      console.error("Operations request action failed.", report),
  })(request, organisationId, requestId);
}
