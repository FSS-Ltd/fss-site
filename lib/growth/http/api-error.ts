export type ApiError = {
  ok: false;
  code: string;
  message: string;
  correlationId: string;
};

const JSON_RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

export function createJsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: JSON_RESPONSE_HEADERS,
  });
}

export function createApiErrorResponse(
  status: number,
  code: string,
  message: string,
  correlationId: string,
): Response {
  const body: ApiError = {
    ok: false,
    code,
    message,
    correlationId,
  };

  return createJsonResponse(body, status);
}
