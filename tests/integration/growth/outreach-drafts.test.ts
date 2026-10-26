import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { getOutreachDrafts } from "../../../lib/growth/dashboard/outreach-drafts";

const connectionString = process.env.DIRECT_DATABASE_URL;

test(
  "outreach exposes pending drafts before enrollment and removes drafts after publication or rejection",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;
    const sql = postgres(connectionString, { max: 1 });
    const rollback = new Error("Rollback outreach draft fixtures");
    const businessId = randomUUID();
    const contactId = randomUUID();
    const prospectId = randomUUID();
    const runId = randomUUID();
    const draftId = randomUUID();
    const newerDraftId = randomUUID();

    try {
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx`
          insert into growth.businesses (
            id, legal_name, corporate_type, corporate_status, sector,
            locality, county, first_party_source_url, verified_at
          ) values (
            ${businessId}, 'Draft Review Ltd', 'limited_company', 'active',
            'Home services', 'Maidstone', 'Kent', 'https://example.test', now()
          )
        `;
          await tx`
          insert into growth.contacts (
            id, business_id, first_name, last_name, email, email_source_url,
            email_verified_at, subscriber_type, lawful_basis
          ) values (
            ${contactId}, ${businessId}, 'Alex', 'Example',
            ${`${contactId}@example.test`}, 'https://example.test/contact',
            now(), 'corporate', 'legitimate_interests'
          )
        `;
          await tx`
          insert into growth.prospects (
            id, business_id, primary_contact_id, status, fit_score,
            opportunity_summary, recommended_offer, estimated_one_off_min_pence,
            estimated_one_off_max_pence, assigned_owner_email
          ) values (
            ${prospectId}, ${businessId}, ${contactId}, 'ready_for_email_review',
            100, 'Reviewed opportunity', 'Website', 100, 200,
            'j.ntagengwa@faithfulsoftware.dev'
          )
        `;
          await tx`
          insert into growth.research_runs (
            id, external_run_id, run_date, timezone, status, target_count,
            prompt_version, started_at
          ) values (
            ${runId}, ${runId}, current_date, 'Europe/London', 'completed',
            1, 'test-v1', now()
          )
        `;
          await tx`
          insert into growth.agent_tasks (
            id, research_run_id, prospect_id, task_type, status,
            output_snapshot, completed_at, idempotency_key
          ) values (
            ${draftId}, ${runId}, ${prospectId}, 'first_email_draft',
            'completed', '{}'::jsonb, now() - interval '1 hour', ${draftId}
          )
        `;

          async function visibleDraftIds(): Promise<string[]> {
            const result = await getOutreachDrafts(tx);
            assert.equal(result.status, "ready");
            return result.rows
              .filter((row) => row.businessName === "Draft Review Ltd")
              .map((row) => row.draftTaskId);
          }

          assert.deepEqual(await visibleDraftIds(), [draftId]);
          await tx`
          insert into growth.agent_tasks (
            id, research_run_id, prospect_id, task_type, status,
            output_snapshot, completed_at, idempotency_key
          ) select ${newerDraftId}, research_run_id, prospect_id, task_type,
            status, '{"reviewState":"draft"}'::jsonb, now(), ${newerDraftId}
          from growth.agent_tasks where id = ${draftId}
        `;
          assert.deepEqual(await visibleDraftIds(), [newerDraftId]);

          await tx`update growth.agent_tasks set completed_at = null where id = ${newerDraftId}`;
          assert.deepEqual(await visibleDraftIds(), [newerDraftId]);

          for (const reviewState of ["provider_draft", "approved"]) {
            await tx`update growth.agent_tasks set output_snapshot = ${tx.json({ reviewState })} where id = ${newerDraftId}`;
            assert.deepEqual(await visibleDraftIds(), []);
          }

          await tx`update growth.agent_tasks set output_snapshot = '{}'::jsonb where id = ${newerDraftId}`;
          await tx`update growth.prospects set status = 'rejected' where id = ${prospectId}`;
          assert.deepEqual(await visibleDraftIds(), []);

          await tx`update growth.prospects set status = 'ready_for_email_review' where id = ${prospectId}`;
          await tx`insert into growth.sequence_enrollments (prospect_id, contact_id, status) values (${prospectId}, ${contactId}, 'active')`;
          assert.deepEqual(await visibleDraftIds(), []);
          throw rollback;
        }),
        (error: unknown) => error === rollback,
      );
    } finally {
      await sql.end();
    }
  },
);
