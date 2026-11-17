import { getToken } from "next-auth/jwt";

const MAX_STREAM_MS = 5 * 60 * 1000;

export async function growthStreamDeadline(
  request: Request,
  secret: string,
): Promise<number | null> {
  const secureCookie = new URL(request.url).protocol === "https:";
  const token = await getToken({ req: request, secret, secureCookie });
  if (typeof token?.exp !== "number" || token.exp * 1000 <= Date.now())
    return null;
  return Math.min(token.exp * 1000, Date.now() + MAX_STREAM_MS);
}
