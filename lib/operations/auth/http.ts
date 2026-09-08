export type PortalAuthHandlerDependencies = {
  enabled: boolean;
  configured: boolean;
  origin: string;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
};

export function privateAuthHeaders(
  correlationId: string,
): Record<string, string> {
  return {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Correlation-ID": correlationId,
  };
}

export function reportAuthError(
  deps: Pick<PortalAuthHandlerDependencies, "reportUnexpectedError">,
  correlationId: string,
  error: unknown,
): void {
  const name = error instanceof Error ? error.name : "UnknownError";
  deps.reportUnexpectedError({
    correlationId,
    errorName: /^[A-Za-z]{1,80}$/.test(name) ? name : "UnknownError",
  });
}
