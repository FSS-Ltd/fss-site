import type { GrowthQueryExecutor } from "../types";

export type ProspectStatus =
  | "new"
  | "researching"
  | "needs_review"
  | "ready_for_email_review"
  | "qualified"
  | "contacted"
  | "replied"
  | "started_talks"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "rejected"
  | "suppressed";

export type ProspectSummary = {
  id: string;
  businessName: string;
  contactName: string | null;
  status: ProspectStatus;
  fitScore: number;
  nextAction: string | null;
  nextActionDueAt: Date | null;
};

export async function findProspectSummaryById(
  db: GrowthQueryExecutor,
  prospectId: string,
): Promise<ProspectSummary | null> {
  const rows = await db<ProspectSummary[]>`
    select
      p.id,
      b.legal_name as "businessName",
      nullif(
        concat_ws(
          ' ',
          nullif(trim(c.first_name), ''),
          nullif(trim(c.last_name), '')
        ),
        ''
      ) as "contactName",
      p.status,
      p.fit_score as "fitScore",
      p.next_action as "nextAction",
      p.next_action_due_at as "nextActionDueAt"
    from growth.prospects p
    inner join growth.businesses b on b.id = p.business_id
    left join growth.contacts c on c.id = p.primary_contact_id
    where p.id = ${prospectId}
    limit 1
  `;

  return rows[0] ?? null;
}
