import { z } from "zod";
import type { VerifiedPortalIdentity } from "../auth/types";
import { withPortalTransaction } from "../db/portal-client";
import { withAgreementTransaction } from "../agreements/repository";
import type { OperationsFounder } from "../organisations/types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import type {
  ClientRequest,
  ClientRequestDetail,
  RequestComment,
  RequestReview,
  RequestDocument,
  RequestAllowance,
  RequestPriority,
  RequestStatus,
} from "./types";

import {
  parseWorkspacePage,
  toWorkspaceCollectionPage,
  workspacePageOffset,
  workspacePageSize,
  type WorkspaceCollectionPage,
} from "../workspaces/pagination";

type RequestListSelection = {
  limit: number;
  offset: number;
  status: RequestStatus | null;
  query: string | null;
};

const defaultRequestListSelection: RequestListSelection = {
  limit: 100,
  offset: 0,
  status: null,
  query: null,
};

export async function loadRequests(
  tx: OperationsTransaction,
  organisationId: string,
  requestId: string | null,
  founderPriority = false,
  selection: RequestListSelection = defaultRequestListSelection,
): Promise<ClientRequest[]> {
  const { limit, offset, status, query } = selection;
  return [
    ...(await tx<
      ClientRequest[]
    >`select id,project_id as "projectId",title,description,type,desired_outcome as "desiredOutcome",desired_date::text as "desiredDate",impact,reproduction_steps as "reproductionSteps",expected_behaviour as "expectedBehaviour",actual_behaviour as "actualBehaviour",status,scope,scope_reason as "scopeReason",owner_display as "ownerDisplay",next_action as "nextAction",target_date::text as "targetDate",version,review_cycle as "reviewCycle",deliverable_version as "deliverableVersion",review_instructions as "reviewInstructions",public_summary as "publicSummary",acknowledgement_target::text as "acknowledgementTarget",review_reminder_target::text as "reviewReminderTarget",created_at::text as "createdAt",case when blocked_since is null then null else jsonb_build_object('since',blocked_since::text,'reason',blocked_reason,'responsibleParty',blocked_responsible_party,'nextCheckDate',blocked_next_check_date::text) end as blocked,transition_reason as "closureReason",closure_label as "closureLabel" from operations.requests where organisation_id=${organisationId} and (${requestId}::uuid is null or id=${requestId}::uuid) and (${status}::text is null or status=${status}::text) and (${query}::text is null or title ilike '%' || ${query} || '%') order by ${founderPriority ? tx`case when status in ('done','cancelled') then 1 else 0 end,case when status='new' and acknowledgement_target<=clock_timestamp() then acknowledgement_target when status='ready_for_review' and review_reminder_target<=clock_timestamp() then review_reminder_target else null end asc nulls last,case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,case when status='new' then acknowledgement_target when status='ready_for_review' then review_reminder_target else coalesce(blocked_next_check_date::timestamptz,created_at) end asc,created_at asc` : tx`created_at desc`},id limit ${limit} offset ${offset}`),
  ];
}
export async function loadRequestDetail(
  tx: OperationsTransaction,
  organisationId: string,
  id: string,
  founder = false,
): Promise<ClientRequestDetail | null> {
  const [request] = await loadRequests(tx, organisationId, id);
  if (!request) return null;
  // Founders explicitly filter public comments as their RLS also permits internal rows.
  const comments = founder
    ? await tx<
        RequestComment[]
      >`select id,body,author_label as "authorLabel",created_at::text as "createdAt" from operations.request_comments where organisation_id=${organisationId} and request_id=${id} and visibility='client' order by created_at desc,id desc limit 200`
    : await tx<
        RequestComment[]
      >`select id,body,author_label as "authorLabel",created_at::text as "createdAt" from operations.request_comments where organisation_id=${organisationId} and request_id=${id} order by created_at desc,id desc limit 200`;
  const reviews = await tx<
    RequestReview[]
  >`select h.id,h.review_cycle as "reviewCycle",h.deliverable_version as "deliverableVersion",h.decision,h.feedback,h.created_at::text as "createdAt",coalesce((select jsonb_agg(case when d.kind='link' then jsonb_build_object('id',d.id,'projectId',d.project_id,'title',d.title,'kind',d.kind,'url',d.url) else jsonb_build_object('id',d.id,'projectId',d.project_id,'title',d.title,'kind',d.kind,'filename',d.filename,'mimeType',d.mime_type,'sizeBytes',d.size_bytes) end) from operations.request_documents rd join operations.documents d on d.id=rd.document_id and d.organisation_id=rd.organisation_id where rd.organisation_id=h.organisation_id and rd.request_id=h.request_id and rd.review_cycle=h.review_cycle and rd.deliverable_version=h.deliverable_version ${founder ? tx`and d.visibility='client' and d.scan_status='cleared' and d.revoked_at is null and (d.expires_at is null or d.expires_at>clock_timestamp())` : tx``}),'[]'::jsonb) as "documents" from operations.request_reviews h where h.organisation_id=${organisationId} and h.request_id=${id} order by h.created_at desc,h.id desc limit 200`;
  const documents = await tx<
    { document: RequestDocument }[]
  >`select case when d.kind='link' then jsonb_build_object('id',d.id,'projectId',d.project_id,'title',d.title,'kind',d.kind,'url',d.url) else jsonb_build_object('id',d.id,'projectId',d.project_id,'title',d.title,'kind',d.kind,'filename',d.filename,'mimeType',d.mime_type,'sizeBytes',d.size_bytes) end as document from operations.documents d where d.organisation_id=${organisationId} and exists(select 1 from operations.request_documents rd where rd.document_id=d.id and rd.organisation_id=d.organisation_id and rd.request_id=${id} and rd.review_cycle=${request.reviewCycle} and rd.deliverable_version=${request.deliverableVersion}) ${founder ? tx`and d.visibility='client' and d.scan_status='cleared' and d.revoked_at is null and (d.expires_at is null or d.expires_at>clock_timestamp()) and exists(select 1 from operations.projects p where p.id=d.project_id and p.organisation_id=d.organisation_id and p.visibility='client')` : tx``} order by d.created_at,d.id limit 100`;
  const allowanceRows = await tx<
    (RequestAllowance["adjustments"][number] & {
      unit: RequestAllowance["unit"];
    })[]
  >`select id,unit,amount::float8 as amount,reason,approval_reference as "approvalReference",created_at::text as "createdAt" from operations.request_allowance_adjustments where organisation_id=${organisationId} and request_id=${id} order by created_at desc,id desc limit 200`;
  const [allowanceTotal] = await tx<
    { total: number; unit: RequestAllowance["unit"] }[]
  >`select sum(amount)::float8 as total,min(unit) as unit from operations.request_allowance_adjustments where organisation_id=${organisationId} and request_id=${id}`;
  const allowance = allowanceRows.length
    ? {
        unit: allowanceRows[0].unit,
        total: allowanceTotal.total,
        adjustments: [...allowanceRows].reverse().map((row) => ({
          id: row.id,
          amount: row.amount,
          reason: row.reason,
          approvalReference: row.approvalReference,
          createdAt: row.createdAt,
        })),
      }
    : null;
  const [permission] = founder
    ? [{ allowed: false }]
    : await tx<
        { allowed: boolean }[]
      >`select operations.can_review_request(${organisationId},${id}) as allowed`;
  return {
    ...request,
    allowance,
    comments: [...comments].reverse(),
    reviews: [...reviews].reverse().map((review) => ({
      ...review,
      documentIds: review.documents.map((document) => document.id),
    })),
    documents: documents.map((row) => row.document),
    canReview: permission.allowed,
  };
}
export type PortalRequestListInput = {
  page: number;
  status?: RequestStatus;
  query?: string;
};

export async function listPortalRequests(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
  input: PortalRequestListInput = { page: 1 },
): Promise<WorkspaceCollectionPage<ClientRequest>> {
  const page = parseWorkspacePage(input.page);
  const query =
    z
      .string()
      .trim()
      .max(100)
      .parse(input.query ?? "") || null;
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx) => {
      const rows = await loadRequests(tx, organisationId, null, false, {
        limit: workspacePageSize + 1,
        offset: workspacePageOffset(page),
        status: input.status ?? null,
        query,
      });
      return toWorkspaceCollectionPage(rows, page);
    },
  );
}
export async function getPortalRequest(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  id: string,
  correlationId: string,
): Promise<ClientRequestDetail | null> {
  z.uuid().parse(id);
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    (tx) => loadRequestDetail(tx, organisationId, id),
  );
}
export async function listFounderRequests(
  db: OperationsDb,
  founder: OperationsFounder | null,
  organisationId: string,
  correlationId: string,
): Promise<ClientRequest[]> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  return withAgreementTransaction(db, founder, (tx) =>
    loadRequests(tx, organisationId, null, true),
  );
}
export type FounderRequestDetail = ClientRequestDetail & {
  priority: RequestPriority;
  internalComments: RequestComment[];
};
export async function getFounderRequest(
  db: OperationsDb,
  founder: OperationsFounder | null,
  organisationId: string,
  id: string,
  correlationId: string,
): Promise<FounderRequestDetail | null> {
  z.uuid().parse(organisationId);
  z.uuid().parse(id);
  z.uuid().parse(correlationId);
  return withAgreementTransaction(db, founder, async (tx) => {
    const request = await loadRequestDetail(tx, organisationId, id, true);
    if (!request) return null;
    const internalComments = await tx<
      RequestComment[]
    >`select id,body,author_label as "authorLabel",created_at::text as "createdAt" from operations.request_comments where organisation_id=${organisationId} and request_id=${id} and visibility='internal' order by created_at desc,id desc limit 200`;
    const [internal] = await tx<
      { priority: RequestPriority }[]
    >`select priority from operations.requests where organisation_id=${organisationId} and id=${id}`;
    return {
      ...request,
      priority: internal.priority,
      internalComments: [...internalComments].reverse(),
    };
  });
}

export async function loadFounderRequestQueue(
  db: OperationsDb,
  founder: OperationsFounder | null,
  organisationId: string,
  correlationId: string,
): Promise<{ requests: ClientRequest[]; observedAt: number }> {
  const requests = await listFounderRequests(
    db,
    founder,
    organisationId,
    correlationId,
  );
  return { requests, observedAt: Date.now() };
}
