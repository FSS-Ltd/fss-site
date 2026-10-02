import { randomUUID } from "node:crypto";
import { z } from "zod";
import { privateAuthHeaders } from "../auth/http";
import { getPortalIdentity } from "../auth/server";
import { PortalAccessDenied } from "../auth/types";
import { getPortalDb, withPortalTransaction } from "../db/portal-client";
import { signingEnabled } from "../agreements/signing-worker";
import { signingHash } from "../agreements/signing-render";

export async function downloadPortalCommercialOfferDocument(
  organisationId: string,
  offerId: string,
  rawOption: string,
): Promise<Response> {
  const correlationId = randomUUID();
  const unavailable = () =>
    Response.json(
      { message: "The offer document is unavailable." },
      { status: 404, headers: privateAuthHeaders(correlationId) },
    );
  if (!signingEnabled()) return unavailable();
  try {
    const identity = await getPortalIdentity();
    const option = z.enum(["cash", "revenue_share"]).parse(rawOption);
    z.uuid().parse(offerId);
    const document = await withPortalTransaction(
      getPortalDb(),
      identity,
      organisationId,
      correlationId,
      async (tx) => {
        const [row] = await tx<
          { bytes: Buffer; hash: string }[]
        >`select * from operations.read_commercial_offer_document(${organisationId},${offerId},${option})`;
        return row;
      },
    );
    if (!document) return unavailable();
    if (signingHash(document.bytes) !== document.hash)
      throw new Error("RetainedArtifactMismatch");
    return new Response(new Uint8Array(document.bytes), {
      headers: {
        ...privateAuthHeaders(correlationId),
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="offer-${option}.pdf"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof PortalAccessDenied)
      return unavailable();
    console.error("Commercial offer download failed.", {
      correlationId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { message: "We could not retrieve this document. Please try again." },
      { status: 503, headers: privateAuthHeaders(correlationId) },
    );
  }
}
