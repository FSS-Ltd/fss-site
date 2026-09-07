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
      <section role="alert">
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
    <div className={layout.page}>
      <Link href={`/growth/operations/clients/${organisationId}/requests`}>
        All requests
      </Link>
      <RequestDetail
        request={publicRequest}
        organisationId={organisationId}
        canComment={false}
        hidePortalActions
      />
      <FounderRequestActions
        request={publicRequest}
        organisationId={organisationId}
        currentPriority={priority}
        deliveryOwners={[{ id: founderDeliveryOwnerId, label: "FSS founder" }]}
        agreements={(register?.agreements ?? [])
          .filter((agreement) => agreement.status === "signed")
          .map((agreement) => ({
            id: agreement.id,
            label: agreement.draft.title,
          }))}
      />
      {register?.nextCursor && (
        <p>
          Showing signed agreements from the current register page.{" "}
          <Link
            href={`/growth/operations/clients/${organisationId}/agreements`}
          >
            Open the full agreement register
          </Link>{" "}
          or use the reviewed request command for an older agreement.
        </p>
      )}
      <section className={layout.internal}>
        <h2>Internal notes</h2>
        <p>Visible only to FSS. Never included in the client thread.</p>
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
    </div>
  );
}
