import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import type { OperationsFounder } from "../organisations/types";
import { AgreementConflict, type AgreementRecord } from "./types";
export type AgreementRouteDependencies = {
  enabled: boolean;
  origin: string;
  authorizeFounder: () => Promise<OperationsFounder>;
  execute: (
    founder: OperationsFounder,
    organisationId: string,
    input: unknown,
    correlationId: string,
  ) => Promise<AgreementRecord>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
};
export function createAgreementRouteHandler(
  deps: AgreementRouteDependencies,
): (request: Request, organisationId: string) => Promise<Response> {
  return async (request, organisationId) => {
    const correlationId = deps.createCorrelationId();
    const reply = (body: object, status: number) =>
      Response.json(body, {
        status,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Correlation-ID": correlationId,
        },
      });
    if (!deps.enabled)
      return reply({ message: "Operations is unavailable." }, 404);
    let founder: OperationsFounder;
    try {
      founder = await deps.authorizeFounder();
    } catch {
      return reply({ message: "Founder authorization is required." }, 403);
    }
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return reply({ message: "The request origin is not allowed." }, 403);
    try {
      z.uuid().parse(organisationId);
      const body = await readJsonRequestBody(request, 64 * 1024);
      const record = await deps.execute(
        founder,
        organisationId,
        body,
        correlationId,
      );
      return reply({ record }, 200);
    } catch (error) {
      if (error instanceof z.ZodError)
        return reply(
          {
            message: "Check the marked fields.",
            issues: error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          422,
        );
      if (error instanceof AgreementConflict)
        return reply({ message: error.message }, 409);
      if (error instanceof PayloadTooLargeError)
        return reply({ message: "The agreement is too large." }, 413);
      if (error instanceof SyntaxError)
        return reply({ message: "The request must contain valid JSON." }, 400);
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23503"
      )
        return reply(
          { message: "Choose an engagement linked to this organisation." },
          422,
        );
      deps.reportUnexpectedError({
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      return reply(
        {
          message: "The agreement could not be saved. Reload and try again.",
          correlationId,
        },
        500,
      );
    }
  };
}
