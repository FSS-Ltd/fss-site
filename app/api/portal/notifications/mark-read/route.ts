import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb, withVerifiedPortalIdentity } from "@/lib/operations/db/portal-client";

export const runtime = "nodejs";

const bodySchema = z.strictObject({ ids: z.array(z.uuid()).min(1).max(100) });

export async function POST(request: Request): Promise<Response> {
  const identity = await getPortalIdentity();
  if (!identity) throw new PortalAccessDenied();
  let body: { ids: string[] };
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid notification list." }, { status: 400 });
  }
  try {
    await withVerifiedPortalIdentity(
      getPortalDb(),
      identity,
      randomUUID(),
      async (tx) => {
        await tx`update operations.request_notifications set read_at = clock_timestamp()
          where user_id = ${identity.userId}
            and read_at is null
            and id in ${tx(body.ids)}`;
      },
    );
  } catch {
    return Response.json(
      { error: "Notifications could not be updated." },
      { status: 503 },
    );
  }
  return Response.json({ ok: true }, { status: 200 });
}
