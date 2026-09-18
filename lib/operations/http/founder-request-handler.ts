import { createRequestCommandHandler } from "./request-command-handler";
import type { OperationsFounder } from "../organisations/types";

export type FounderRequestDependencies = {
  enabled: boolean;
  origin: string;
  authorizeFounder: () => Promise<OperationsFounder>;
  execute: (
    founder: OperationsFounder,
    organisationId: string,
    command: unknown,
    correlationId: string,
  ) => Promise<{ id: string; version: number }>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
};

export function createFounderRequestHandler(
  deps: FounderRequestDependencies,
): (
  request: Request,
  organisationId: string,
  requestId: string,
) => Promise<Response> {
  return createRequestCommandHandler<OperationsFounder>({
    enabled: deps.enabled,
    origin: deps.origin,
    authorize: deps.authorizeFounder,
    execute: deps.execute,
    createCorrelationId: deps.createCorrelationId,
    reportUnexpectedError: deps.reportUnexpectedError,
    unauthorizedMessage: "Founder authorization is required.",
  });
}
