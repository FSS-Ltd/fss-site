import { z } from "zod";
import type { GrowthQueryExecutor } from "../db/types";
export type CrmEnquiry = {
  id: string;
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  challenge: string | null;
  submittedAt: string;
  prospectId: string | null;
  sourcePath: string;
  submissionType: string;
};
const cursorSchema = z.object({
  at: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export async function getCrmEnquiries(
  db: GrowthQueryExecutor,
  after?: string,
): Promise<{ rows: CrmEnquiry[]; nextCursor: string | null }> {
  let cursor: z.infer<typeof cursorSchema> | null = null;
  if (after && after.length <= 400) {
    try {
      cursor = cursorSchema.parse(
        JSON.parse(Buffer.from(after, "base64url").toString("utf8")),
      );
    } catch {
      cursor = null;
    }
  }
  const rows = await db<
    (Omit<CrmEnquiry, "submittedAt"> & {
      submittedAt: Date;
      cursorAt: string;
    })[]
  >`select to_char(i.submitted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "cursorAt",i.id,i.business_name as "businessName",i.first_name as "firstName",i.last_name as "lastName",i.work_email as email,i.challenge,i.submitted_at as "submittedAt",c.prospect_id as "prospectId",i.source_path as "sourcePath",i.submission_type as "submissionType"
 from growth.inbound_leads i left join growth.crm_capture_requests c on c.inbound_lead_id=i.id
 ${cursor ? db`where (i.submitted_at,i.id)<(${cursor.at}::text::timestamptz,${cursor.id}::uuid)` : db``}
 order by i.submitted_at desc,i.id desc limit 21`;
  const page = rows
    .slice(0, 20)
    .map((row) => ({ ...row, submittedAt: row.submittedAt.toISOString() }));
  const last = rows.slice(0, 20).at(-1);
  return {
    rows: page,
    nextCursor:
      rows.length > 20 && last
        ? Buffer.from(
            JSON.stringify({ at: last.cursorAt, id: last.id }),
          ).toString("base64url")
        : null,
  };
}
export async function getCrmEnquiry(
  db: GrowthQueryExecutor,
  id: string,
): Promise<CrmEnquiry | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db<
    (Omit<CrmEnquiry, "submittedAt"> & { submittedAt: Date })[]
  >`select i.id,i.business_name as "businessName",i.first_name as "firstName",i.last_name as "lastName",i.work_email as email,i.challenge,i.submitted_at as "submittedAt",c.prospect_id as "prospectId",i.source_path as "sourcePath",i.submission_type as "submissionType" from growth.inbound_leads i left join growth.crm_capture_requests c on c.inbound_lead_id=i.id where i.id=${id} limit 1`;
  return row ? { ...row, submittedAt: row.submittedAt.toISOString() } : null;
}
