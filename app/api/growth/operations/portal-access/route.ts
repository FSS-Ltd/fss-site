import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";
import { applyPortalOperation, portalOperationSchema } from "@/lib/operations/auth/operator";
import { resolvePortalOrigin } from "@/lib/operations/auth/configuration";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!operationsEnabled()) return Response.json({ message: "Unavailable." }, { status: 404 });
  const origin = new URL(resolveSiteUrl()).origin;
  if (!requestHasRegisteredOrigin(request, origin))
    return Response.json({ message: "Request origin is not allowed." }, { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    return Response.json({ message: "Send a JSON request." }, { status: 415 });
  try {
    const operation = portalOperationSchema.parse(
      await readJsonRequestBody(request, 8 * 1024),
    );
    const result = await applyPortalOperation(
      getOperationsDb(),
      await requireFounder(),
      operation,
      resolvePortalOrigin(),
    );
    return Response.json(result, { status: 200, headers: { "X-Correlation-Id": randomUUID() } });
  } catch (error) {
    const status = error instanceof PayloadTooLargeError ? 413 : error instanceof z.ZodError ? 422 : 500;
    return Response.json(
      { message: status === 500 ? "Portal access could not be updated." : "Check the access details and try again." },
      { status, headers: { "X-Correlation-Id": randomUUID() } },
    );
  }
}
