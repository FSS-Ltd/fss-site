import { translateRequestError } from "./errors";
import { z } from "zod";
import type { VerifiedPortalIdentity } from "../auth/types";
import { PortalAccessDenied } from "../auth/types";
import type { OperationsDb } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";
import {
  addOperationsBusinessDays,
  operationsCalendarVersion,
} from "../business-calendar";
import { createRequestSchema, portalRequestCommandSchema } from "./validation";
import { loadRequests } from "./repository";
import { type ClientRequest, type RequestCommandResult } from "./types";
export { executeFounderRequestCommand } from "./founder-service";
export async function createPortalRequest(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<ClientRequest> {
  const input = createRequestSchema.parse(raw);
  try {
    return await withPortalTransaction(
      db,
      identity,
      organisationId,
      correlationId,
      async (tx) => {
        const target = addOperationsBusinessDays(new Date(), 1).toISOString();
        const [row] = await tx<
          { id: string }[]
        >`select operations.create_portal_request(${organisationId},${tx.json(input)},${target}::timestamptz,${operationsCalendarVersion}) as id`;
        const [request] = await loadRequests(tx, organisationId, row.id);
        if (!request) throw new PortalAccessDenied();
        return request;
      },
    );
  } catch (error) {
    translateRequestError(error);
  }
}
export async function executePortalRequestCommand(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<RequestCommandResult> {
  z.uuid().parse(organisationId);
  const input = portalRequestCommandSchema.parse(raw);
  try {
    return await withPortalTransaction(
      db,
      identity,
      organisationId,
      correlationId,
      async (tx) => {
        const [row] = await tx<
          { version: number }[]
        >`select operations.portal_request_command(${organisationId},${tx.json(input)}) as version`;
        return { id: input.requestId, version: row.version };
      },
    );
  } catch (error) {
    translateRequestError(error);
  }
}
