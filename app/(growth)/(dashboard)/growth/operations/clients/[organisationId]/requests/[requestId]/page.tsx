import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listAgreementRegister } from "@/lib/operations/agreements/repository";
import { getFounderRequest } from "@/lib/operations/requests/repository";
import { founderDeliveryOwnerId } from "@/lib/operations/requests/types";
import { RequestDetail } from "@/components/portal/requests/request-detail";
import { FounderRequestActions } from "@/components/portal/requests/founder-request-actions";
import { OperationsPageHeader } from "@/components/operations/shared/operations-page-header";
import ui from "@/components/operations/shared/operations-ui.module.css";
import layout from "@/components/operations/requests/requests.module.css";
export const dynamic = "force-dynamic";
export default async function FounderRequestPage({
  params,
}: {
  params: Promise<{ organisationId: string; requestId: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  const founder = await requireFounder();
  const parsed = z
    .object({ organisationId: z.uuid(), requestId: z.uuid() })
    .safeParse(await params);
  if (!parsed.success) notFound();
  const { organisationId, requestId } = parsed.data;
  let request, register;
  try {
    request = await getFounderRequest(
      getOperationsDb(),
      founder,
      organisationId,
      requestId,
      randomUUID(),
    );
    register = await listAgreementRegister(
      getOperationsDb(),
      founder,
      organisationId,
    );
  } catch {
    return (
      <section className={ui.errorState} role="alert">
        <h1>Request could not load</h1>
        <p>Reload to try again.</p>
        <Link href={`/growth/operations/clients/${organisationId}/requests`}>
          All requests
        </Link>
      </section>
    );
  }
  if (!request) notFound();
  const { internalComments, priority, ...publicRequest } = request;
  return (
    <main className={`${ui.page} ${layout.page}`}>
      <OperationsPageHeader
        context="Operations · Requests"
        title="Request workspace"
        description="Review the client request, record the operational decision and keep the next action current."
        action={
          <Link href={`/growth/operations/clients/${organisationId}/requests`}>
            All requests
          </Link>
        }
      />
      <section className={`${ui.panel} ${layout.detail}`}>
        <RequestDetail
          request={publicRequest}
          organisationId={organisationId}
          canComment={false}
          hidePortalActions
        />
      </section>
      <section className={`${ui.panel} ${layout.actionPanel}`}>
        <FounderRequestActions
          request={publicRequest}
          organisationId={organisationId}
          currentPriority={priority}
          deliveryOwners={[
            { id: founderDeliveryOwnerId, label: "FSS founder" },
          ]}
          agreements={(register?.agreements ?? [])
            .filter((agreement) => agreement.status === "signed")
            .map((agreement) => ({
              id: agreement.id,
              label: agreement.draft.title,
            }))}
        />
      </section>
      {register?.nextCursor && (
        <p className={`${ui.panel} ${layout.registerNotice}`}>
          Showing signed agreements from the current register page.{" "}
          <Link
            href={`/growth/operations/clients/${organisationId}/agreements`}
          >
            Open the full agreement register
          </Link>{" "}
          or use the reviewed request command for an older agreement.
        </p>
      )}
      <section className={`${ui.panel} ${layout.internal}`}>
        <div className={layout.internalHeading}>
          <h2>Internal notes</h2>
          <span className={ui.statusChip}>Visible only to FSS</span>
        </div>
        <p>Never included in the client thread.</p>
        {internalComments.length === 0 ? (
          <p>No internal notes.</p>
        ) : (
          <ul>
            {internalComments.map((comment) => (
              <li key={comment.id}>
                <strong>{comment.authorLabel}</strong>
                <p>{comment.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
