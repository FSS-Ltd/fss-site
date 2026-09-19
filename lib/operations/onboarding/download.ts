import { z } from "zod";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import { withAgreementTransaction } from "../agreements/repository";
import { privateAuthHeaders, reportAuthError } from "../auth/http";
export async function loadWelcomePdf(
  db: OperationsDb,
  founder: OperationsFounder,
  organisationId: string,
  journeyId: string,
): Promise<Buffer | null> {
  z.uuid().parse(organisationId);
  z.uuid().parse(journeyId);
  return withAgreementTransaction(db, founder, (tx) =>
    loadWelcomePdfInTransaction(tx, organisationId, journeyId),
  );
}
async function loadWelcomePdfInTransaction(
  tx: OperationsTransaction,
  organisationId: string,
  journeyId: string,
): Promise<Buffer | null> {
  const [row] = await tx<
    { pdf: Buffer }[]
  >`select a.pdf from operations.onboarding_journeys j join operations.onboarding_approvals a on a.id=j.approval_id where j.organisation_id=${organisationId} and j.id=${journeyId}`;
  return row?.pdf ?? null;
}

export async function loadStaffWelcomePdf(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  journeyId: string,
): Promise<Buffer | null> {
  z.uuid().parse(organisationId);
  z.uuid().parse(journeyId);
  return withFssAdminTransaction(db, admin, (tx) =>
    loadWelcomePdfInTransaction(tx, organisationId, journeyId),
  );
}

export function createWelcomeDownloadHandler<Identity>(deps: {
  enabled: boolean;
  authorize: () => Promise<Identity | null>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
  download: (
    identity: Identity,
    organisationId: string,
    journeyId: string,
  ) => Promise<Buffer | null>;
}) {
  return async (
    organisationId: string,
    journeyId: string,
  ): Promise<Response> => {
    const correlationId = deps.createCorrelationId(),
      headers = privateAuthHeaders(correlationId);
    const unavailable = (status: number) =>
      Response.json(
        { message: "The welcome document is unavailable." },
        { status, headers },
      );
    if (!deps.enabled) return unavailable(404);
    try {
      const founder = await deps.authorize();
      if (!founder) return unavailable(401);
      const bytes = await deps.download(founder, organisationId, journeyId);
      if (!bytes) return unavailable(404);
      return new Response(new Uint8Array(bytes), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="FSS-welcome-guide.pdf"',
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return unavailable(404);
      reportAuthError(deps, correlationId, error);
      return unavailable(503);
    }
  };
}
