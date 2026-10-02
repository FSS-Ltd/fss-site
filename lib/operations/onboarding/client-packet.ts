import { createHash } from "node:crypto";
import { z } from "zod";
import { hasPortalCapability } from "../auth/permissions";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";
import { welcomeInputSchema } from "./approval-schema";
import type { ClientWelcomePacket } from "./client-packet-contract";

const retainedPacketSchema = z.strictObject({
  approvalId: z.uuid(),
  approvedAt: z.string().min(1).max(100),
  content: welcomeInputSchema.shape.content,
});
export type ClientPacketDownload = Readonly<{ pdf: Buffer; hash: string }>;

export async function readClientWelcomePacket(
  tx: OperationsTransaction,
  organisationId: string,
): Promise<ClientWelcomePacket | null> {
  const [row] = await tx<Array<{ packet: unknown }>>`
    select operations.read_client_welcome_packet(${organisationId}) as packet
  `;
  if (!row?.packet) return null;
  const { approvalId, approvedAt, content } = retainedPacketSchema.parse(
    row.packet,
  );
  const clientName = content.clientOrganisationName ?? content.organisationName;
  return {
    approvalId,
    approvedAt,
    rendererVersion: content.rendererVersion,
    edition: content.edition,
    title: `${clientName}: your welcome ${content.rendererVersion === 2 ? "packet" : "guide"}`,
    organisationName: content.organisationName,
    senderName: content.senderName,
    pages: content.pages,
  };
}

export async function loadClientWelcomePacket(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
): Promise<ClientWelcomePacket | null> {
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "onboarding.read"))
        throw new PortalAccessDenied();
      return readClientWelcomePacket(tx, organisationId);
    },
  );
}

export async function downloadClientWelcomePacket(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  approvalId: string,
  correlationId: string,
): Promise<ClientPacketDownload | null> {
  z.uuid().parse(approvalId);
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx, context) => {
      if (!hasPortalCapability(context.role, "onboarding.read"))
        throw new PortalAccessDenied();
      const [row] = await tx<Array<{ pdf: Buffer; hash: string }>>`
      select pdf, pdf_hash as hash
      from operations.read_client_welcome_packet_pdf(${organisationId}, ${approvalId})
    `;
      if (!row) return null;
      if (
        !Buffer.isBuffer(row.pdf) ||
        row.pdf.length > 2 * 1024 * 1024 ||
        row.pdf.subarray(0, 5).toString() !== "%PDF-" ||
        createHash("sha256").update(row.pdf).digest("hex") !== row.hash
      )
        throw new Error("RetainedWelcomePacketMismatch");
      return { pdf: row.pdf, hash: row.hash };
    },
  );
}
