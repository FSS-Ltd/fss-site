export class PayloadTooLargeError extends Error {}

export function requestHasRegisteredOrigin(
  request: Request,
  origin: string | readonly string[],
): boolean {
  const requestOrigin = new URL(request.url).origin;
  const allowedOrigins = typeof origin === "string" ? [origin] : origin;

  return (
    request.headers.get("origin") === requestOrigin &&
    allowedOrigins.includes(requestOrigin)
  );
}

export async function readJsonRequestBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > maxBytes
  ) {
    throw new PayloadTooLargeError();
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new PayloadTooLargeError();
  }

  return JSON.parse(text) as unknown;
}
