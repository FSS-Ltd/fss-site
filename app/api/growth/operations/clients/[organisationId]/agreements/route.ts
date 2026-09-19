import { randomUUID } from "node:crypto";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { createAgreementRouteHandler } from "@/lib/operations/agreements/route-handler";
import { executeAgreementCommand } from "@/lib/operations/agreements/service";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ organisationId: string }> },
): Promise<Response> {
  const handler = createAgreementRouteHandler({
    enabled: operationsEnabled(),
    origin: new URL(resolveSiteUrl()).origin,
    authorize: requireFounder,
    execute: (founder, organisationId, input, correlationId) =>
      executeAgreementCommand(
        getOperationsDb(),
        founder,
        organisationId,
        input,
        correlationId,
      ),
    createCorrelationId: randomUUID,
    reportUnexpectedError: (report) =>
      console.error("Operations agreement action failed.", report),
  });
  return handler(request, (await context.params).organisationId);
}
