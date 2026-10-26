import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import type { CaptureLead } from "../../../lib/growth/crm/schemas";

export const crmTestFounder = {
  email: "j.ntagengwa@faithfulsoftware.dev",
  actorId: createHash("sha256")
    .update("j.ntagengwa@faithfulsoftware.dev")
    .digest("hex"),
};
export async function withCrmTestDatabase(
  operation: (sql: postgres.Sql, newLead: () => CaptureLead) => Promise<void>,
  connection = process.env.DIRECT_DATABASE_URL,
): Promise<void> {
  if (!connection)
    throw new Error(
      "DIRECT_DATABASE_URL is required for CRM integration tests.",
    );
  const sql = postgres(connection, { max: 1 });
  const companies: string[] = [];
  const newLead = (): CaptureLead => {
    const companyNumber = randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();
    companies.push(companyNumber);
    return {
      kind: "capture",
      requestId: randomUUID(),
      businessName: "CRM Test Company",
      companyNumber,
      corporateType: "limited_company",
      sector: "Engineering",
      locality: "Maidstone",
      sourceUrl: "https://example.test/about",
      websiteUrl: null,
      opportunitySummary: "Improve enquiry workflow",
      recommendedOffer: "Website",
      oneOffMinPence: 10000,
      oneOffMaxPence: 20000,
      monthlyPence: 300,
    };
  };
  try {
    await operation(sql, newLead);
  } finally {
    try {
      await sql`reset role`;
      for (const companyNumber of companies) {
        const prospects = await sql<
          { id: string }[]
        >`select p.id from growth.prospects p join growth.businesses b on b.id=p.business_id where b.company_number=${companyNumber}`;
        for (const prospect of prospects) {
          await sql`delete from growth.audit_log where entity_id=${prospect.id} or entity_id in (select id::text from growth.delivery_engagements where prospect_id=${prospect.id})`;
          const links = await sql<
            { inboundLeadId: string | null }[]
          >`delete from growth.crm_capture_requests where prospect_id=${prospect.id} returning inbound_lead_id as "inboundLeadId"`;
          for (const link of links)
            if (link.inboundLeadId)
              await sql`delete from growth.inbound_leads where id=${link.inboundLeadId}`;
          await sql`delete from growth.crm_activities where prospect_id=${prospect.id}`;
          await sql`delete from growth.crm_tasks where prospect_id=${prospect.id}`;
          await sql`delete from growth.commercial_stage_events where engagement_id in (select id from growth.delivery_engagements where prospect_id=${prospect.id})`;
          await sql`delete from growth.delivery_engagements where prospect_id=${prospect.id}`;
          await sql`delete from growth.prospects where id=${prospect.id}`;
        }
        await sql`delete from growth.contacts where business_id in (select id from growth.businesses where company_number=${companyNumber})`;
        await sql`delete from growth.businesses where company_number=${companyNumber}`;
      }
    } finally {
      await sql.end();
    }
  }
}
