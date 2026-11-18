import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";

const url = process.env.DIRECT_DATABASE_URL;
if (
  !url ||
  !/^postgres(?:ql)?:\/\/[^@]+@(?:127\.0\.0\.1|localhost):5548[78]\/fss_growth_test$/.test(
    url,
  )
)
  throw new Error("A disposable local fss_growth_test database is required.");

const tables = [
  "campaigns",
  "campaign_memberships",
  "outreach_events",
  "outreach_reservations",
  "outreach_outbox",
  "outreach_jobs",
  "experiment_reviews",
  "facebook_destinations",
  "facebook_activities",
  "outreach_provider_usage",
  "outreach_permissions",
];

test("campaign tables are private and client lookup is narrowly executable", async () => {
  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql<
      { name: string; rls: boolean; app: boolean; anon: boolean }[]
    >`
      select c.relname as name, c.relrowsecurity as rls,
        has_table_privilege('growth_app', c.oid, 'select') as app,
        has_table_privilege('anon', c.oid, 'select') as anon
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='growth' and c.relname=any(${tables}::text[])`;
    assert.equal(rows.length, tables.length);
    assert.ok(rows.every((row) => row.rls && row.app && !row.anon));
    const [privilege] = await sql<
      { app: boolean; anonymous: boolean; ops: boolean }[]
    >`
      select has_function_privilege('growth_app','growth.is_outreach_client(uuid)','execute') as app,
        has_function_privilege('anon','growth.is_outreach_client(uuid)','execute') as anonymous,
        has_table_privilege('growth_app','operations.contacts','select') as ops`;
    assert.deepEqual(privilege, { app: true, anonymous: false, ops: false });
  } finally {
    await sql.end();
  }
});

test("client guard crosses forced RLS without exposing Operations rows", async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await sql
      .begin(async (tx) => {
        const [business] = await tx<
          { id: string }[]
        >`insert into growth.businesses (legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values ('Outreach guard test','unknown','uncertain','Unclassified','Not provided','https://example.test','GB') returning id`;
        const [prospect] = await tx<
          { id: string }[]
        >`insert into growth.prospects (business_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${business.id},'needs_review',0,'test','test',0,0,'j.ntagengwa@faithfulsoftware.dev') returning id`;
        const [org] = await tx<
          { id: string }[]
        >`insert into operations.organisations (id,legal_name,display_name,trading_status,timezone,created_by,review_reference) values (gen_random_uuid(),'Different client','Different client','active','Europe/London',${"a".repeat(64)},'test') returning id`;
        await tx`insert into operations.contacts (organisation_id,name,email,created_by,review_reference) values (${org.id},'Test','founder@example.test',${"a".repeat(64)},'test')`;
        await tx`update growth.prospects set source_details=${tx.json({ email: "founder@example.test" })} where id=${prospect.id}`;
        const [before] = await tx<
          { count: string }[]
        >`select count(*)::text as count from operations.contacts where organisation_id=${org.id}`;
        await tx`set local role growth_app`;
        const [result] = await tx<
          { matched: boolean }[]
        >`select growth.is_outreach_client(${prospect.id}) as matched`;
        assert.equal(result.matched, true);
        const [access] = await tx<
          { allowed: boolean }[]
        >`select has_schema_privilege(current_user,'operations','usage') as allowed`;
        assert.equal(access.allowed, false);
        await tx`reset role`;
        const [after] = await tx<
          { count: string }[]
        >`select count(*)::text as count from operations.contacts where organisation_id=${org.id}`;
        assert.equal(after.count, before.count);
        throw new Error("rollback fixture");
      })
      .catch((error: Error) => {
        if (error.message !== "rollback fixture") throw error;
      });
  } finally {
    await sql.end();
  }
});

test("job claims are bounded and distinct across workers", async () => {
  const sql = postgres(url, { max: 3 });
  const prefix = `test-${crypto.randomUUID()}`;
  try {
    for (let i = 0; i < 30; i++)
      await sql`insert into growth.outreach_jobs (job_type,due_at,idempotency_key) values ('test','2000-01-01T00:00:00Z',${`${prefix}-${i}`})`;
    await assert.rejects(
      sql`select id from growth.claim_outreach_jobs(${prefix},null,interval '1 minute')`,
      /invalid/,
    );
    const [a, b] = await Promise.all([
      sql<
        { id: string; key: string }[]
      >`select id,idempotency_key as key from growth.claim_outreach_jobs(${prefix},5,interval '1 minute')`,
      sql<
        { id: string; key: string }[]
      >`select id,idempotency_key as key from growth.claim_outreach_jobs(${prefix},25,interval '1 minute')`,
    ]);
    assert.equal(a.length + b.length, 30);
    assert.equal(a.length, 5);
    assert.equal(b.length, 25);
    assert.ok([...a, ...b].every((job) => job.key.startsWith(`${prefix}-`)));
    assert.equal(new Set([...a, ...b].map((job) => job.id)).size, 30);
  } finally {
    await sql`delete from growth.outreach_jobs where idempotency_key like ${`${prefix}-%`}`;
    await sql.end();
  }
});

test("membership business must match its prospect", async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await sql
      .begin(async (tx) => {
        const businesses = await tx<
          { id: string }[]
        >`insert into growth.businesses (legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values ('Test A','unknown','uncertain','Unclassified','Not provided','https://example.test','GB'),('Test B','unknown','uncertain','Unclassified','Not provided','https://example.test','GB') returning id`;
        const [prospect] = await tx<
          { id: string }[]
        >`insert into growth.prospects (business_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${businesses[0].id},'needs_review',0,'test','test',0,0,'j.ntagengwa@faithfulsoftware.dev') returning id`;
        const [campaign] = await tx<
          { id: string }[]
        >`insert into growth.campaigns (version,request_id,name,policy) values (1,gen_random_uuid(),'test','{}') returning id`;
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`insert into growth.campaign_memberships (campaign_id,policy_version,business_id,prospect_id,request_id) values (${campaign.id},1,${businesses[1].id},${prospect.id},gen_random_uuid())`;
          }),
          /foreign key/,
        );
        await tx`insert into growth.campaign_memberships (campaign_id,policy_version,business_id,prospect_id,request_id) values (${campaign.id},1,${businesses[0].id},${prospect.id},gen_random_uuid())`;
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`insert into growth.campaign_memberships (campaign_id,policy_version,business_id,prospect_id,request_id) values (${campaign.id},1,${businesses[0].id},${prospect.id},gen_random_uuid())`;
          }),
          /unique/,
        );
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`update growth.campaigns set policy='{"version":2}' where id=${campaign.id}`;
          }),
          /immutable/,
        );
        const [member] = await tx<
          { id: string }[]
        >`select id from growth.campaign_memberships where campaign_id=${campaign.id}`;
        const [permission] = await tx<
          { id: string }[]
        >`insert into growth.outreach_permissions (id,membership_id,basis,provider,jurisdiction,expires_at,actor_id,evidence,contact_version,prospect_version) values (gen_random_uuid(),${member.id},'consent','gmail','GB',now()+interval '1 day',${"a".repeat(64)},'{}',0,1) returning id`;
        await tx`set local role growth_app`;
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`update growth.outreach_permissions set evidence='{"changed":true}' where id=${permission.id}`;
          }),
          /permission denied/,
        );
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`delete from growth.outreach_permissions where id=${permission.id}`;
          }),
          /permission denied/,
        );
        await tx`reset role`;
        const eventId = crypto.randomUUID();
        await tx`insert into growth.outreach_events (id,campaign_id,policy_version,event_type) values (${eventId},${campaign.id},1,'test')`;
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`insert into growth.outreach_events (id,campaign_id,policy_version,event_type) values (${eventId},${campaign.id},1,'test')`;
          }),
          /unique/,
        );
        throw new Error("rollback fixture");
      })
      .catch((error: Error) => {
        if (error.message !== "rollback fixture") throw error;
      });
  } finally {
    await sql.end();
  }
});

test("concurrent campaign memberships permit one active business", async () => {
  const sql = postgres(url, { max: 4 });
  const [business] = await sql<
    { id: string }[]
  >`insert into growth.businesses (legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values ('Race test','unknown','uncertain','Unclassified','Not provided','https://example.test','GB') returning id`;
  const [prospect] = await sql<
    { id: string }[]
  >`insert into growth.prospects (business_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${business.id},'needs_review',0,'test','test',0,0,'j.ntagengwa@faithfulsoftware.dev') returning id`;
  const campaigns = await sql<
    { id: string }[]
  >`insert into growth.campaigns (version,request_id,name,policy) values (1,gen_random_uuid(),'race A','{}'),(1,gen_random_uuid(),'race B','{}') returning id`;
  try {
    const results = await Promise.allSettled(
      campaigns.map((campaign) =>
        sql.begin(async (tx) => {
          await tx`set local role growth_app`;
          await tx`insert into growth.campaign_memberships (campaign_id,policy_version,business_id,prospect_id,request_id) values (${campaign.id},1,${business.id},${prospect.id},gen_random_uuid())`;
        }),
      ),
    );
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const failure = results.find((result) => result.status === "rejected");
    assert.ok(
      failure &&
        failure.status === "rejected" &&
        /unique/.test(String(failure.reason)),
    );
  } finally {
    await sql`delete from growth.campaign_memberships where business_id=${business.id}`;
    await sql`delete from growth.campaigns where id=any(${campaigns.map((c) => c.id)}::uuid[])`;
    await sql`delete from growth.prospects where id=${prospect.id}`;
    await sql`delete from growth.businesses where id=${business.id}`;
    await sql.end();
  }
});

test("rolled-back campaign writes stay invisible", async () => {
  const sql = postgres(url, { max: 1 });
  const requestId = crypto.randomUUID();
  try {
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx`insert into growth.campaigns (version,request_id,name,policy) values (1,${requestId},'rollback','{}')`;
        throw new Error("rollback fixture");
      }),
      /rollback fixture/,
    );
    const rows =
      await sql`select id from growth.campaigns where request_id=${requestId}`;
    assert.equal(rows.length, 0);
  } finally {
    await sql.end();
  }
});

test("campaign references cannot cross membership or sequence boundaries", async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await sql
      .begin(async (tx) => {
        const businesses = await tx<
          { id: string }[]
        >`insert into growth.businesses (legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values ('Cross A','unknown','uncertain','Unclassified','Not provided','https://example.test','GB'),('Cross B','unknown','uncertain','Unclassified','Not provided','https://example.test','GB') returning id`;
        const [contact1] = await tx<
          { id: string }[]
        >`insert into growth.contacts (business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${businesses[0].id},${`${crypto.randomUUID()}@example.test`},'https://example.test',now(),'uncertain','consent') returning id`;
        const [contact] = await tx<
          { id: string }[]
        >`insert into growth.contacts (business_id,email,email_source_url,email_verified_at,subscriber_type,lawful_basis) values (${businesses[1].id},${`${crypto.randomUUID()}@example.test`},'https://example.test',now(),'uncertain','consent') returning id`;
        const prospects = await tx<
          { id: string }[]
        >`insert into growth.prospects (business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email) values (${businesses[0].id},${contact1.id},'needs_review',0,'test','test',0,0,'j.ntagengwa@faithfulsoftware.dev'),(${businesses[1].id},${contact.id},'needs_review',0,'test','test',0,0,'j.ntagengwa@faithfulsoftware.dev') returning id`;
        const [sequence] = await tx<
          { id: string }[]
        >`insert into growth.sequence_enrollments (prospect_id,contact_id,status) values (${prospects[1].id},${contact.id},'paused') returning id`;
        const [sequence1] = await tx<
          { id: string }[]
        >`insert into growth.sequence_enrollments (prospect_id,contact_id,status) values (${prospects[0].id},${contact1.id},'paused') returning id`;
        const [message] = await tx<
          { id: string }[]
        >`insert into growth.email_messages (sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key) values (${sequence1.id},${prospects[0].id},${contact1.id},'gmail','outbound',0,'draft',gen_random_uuid()::text) returning id`;
        const campaigns = await tx<
          { id: string }[]
        >`insert into growth.campaigns (version,request_id,name,policy) values (1,gen_random_uuid(),'cross A','{}'),(1,gen_random_uuid(),'cross B','{}') returning id`;
        const [member] = await tx<
          { id: string }[]
        >`insert into growth.campaign_memberships (campaign_id,policy_version,business_id,prospect_id,request_id) values (${campaigns[0].id},1,${businesses[0].id},${prospects[0].id},gen_random_uuid()) returning id`;
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`update growth.campaign_memberships set sequence_id=${sequence.id} where id=${member.id}`;
          }),
          /foreign key/,
        );
        await tx`update growth.campaign_memberships set sequence_id=${sequence1.id} where id=${member.id}`;
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`insert into growth.outreach_events (id,campaign_id,policy_version,membership_id,event_type) values (gen_random_uuid(),${campaigns[1].id},1,${member.id},'test')`;
          }),
          /foreign key/,
        );
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`insert into growth.outreach_jobs (campaign_id,policy_version,membership_id,job_type,due_at,idempotency_key) values (${campaigns[1].id},1,${member.id},'test',now(),gen_random_uuid()::text)`;
          }),
          /foreign key/,
        );
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`insert into growth.outreach_jobs (membership_id,job_type,due_at,idempotency_key) values (${member.id},'test',now(),gen_random_uuid()::text)`;
          }),
          /check/,
        );
        await tx`insert into growth.outreach_jobs (job_type,due_at,idempotency_key) values ('test',now(),gen_random_uuid()::text)`;
        await tx`insert into growth.outreach_provider_usage (account_id,observed_at,rolling_messages,rolling_recipients,message_limit,recipient_limit,complete,health) values ('test-cross',now(),0,0,100,100,true,'healthy')`;
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`insert into growth.outreach_reservations (idempotency_key,campaign_id,policy_version,membership_id,account_id,london_day,email_message_id,sequence_id) values (gen_random_uuid()::text,${campaigns[1].id},1,${member.id},'test-cross',current_date,${message.id},${sequence1.id})`;
          }),
          /foreign key/,
        );
        await tx`insert into growth.outreach_reservations (idempotency_key,campaign_id,policy_version,membership_id,account_id,london_day,email_message_id,sequence_id) values (gen_random_uuid()::text,${campaigns[0].id},1,${member.id},'test-cross',current_date,${message.id},${sequence1.id})`;
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`insert into growth.outreach_reservations (idempotency_key,campaign_id,account_id,london_day,email_message_id,sequence_id) values (gen_random_uuid()::text,${campaigns[0].id},'test-cross',current_date,${message.id},${sequence1.id})`;
          }),
          /check/,
        );
        await tx`insert into growth.outreach_reservations (idempotency_key,account_id,london_day,email_message_id,sequence_id) values (gen_random_uuid()::text,'test-cross',current_date,${message.id},${sequence1.id})`;
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`insert into growth.outreach_reservations (idempotency_key,account_id,london_day,email_message_id,sequence_id) values (gen_random_uuid()::text,'test-cross',current_date,${message.id},${sequence.id})`;
          }),
          /foreign key/,
        );
        throw new Error("rollback fixture");
      })
      .catch((error: Error) => {
        if (error.message !== "rollback fixture") throw error;
      });
  } finally {
    await sql.end();
  }
});

test("approval attribution cannot change after approval", async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await sql
      .begin(async (tx) => {
        const [campaign] = await tx<
          { id: string }[]
        >`insert into growth.campaigns (version,request_id,name,policy,status,approved_by,approved_at) values (1,gen_random_uuid(),'approval','{}','approved',${"a".repeat(64)},now()) returning id`;
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`update growth.campaigns set approved_by=${"b".repeat(64)} where id=${campaign.id}`;
          }),
          /immutable/,
        );
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`update growth.campaigns set approved_at=now()+interval '1 day' where id=${campaign.id}`;
          }),
          /immutable/,
        );
        await tx`update growth.campaigns set status='revoked' where id=${campaign.id}`;
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`update growth.campaigns set approved_by=null, approved_at=null where id=${campaign.id}`;
          }),
          /immutable/,
        );
        throw new Error("rollback fixture");
      })
      .catch((error: Error) => {
        if (error.message !== "rollback fixture") throw error;
      });
  } finally {
    await sql.end();
  }
});

test("client matching rejects malformed domains and normalizes website ports", async () => {
  const sql = postgres(url, { max: 1 });
  try {
    await sql
      .begin(async (tx) => {
        const [business] = await tx<
          { id: string }[]
        >`insert into growth.businesses (legal_name,corporate_type,corporate_status,sector,locality,first_party_source_url,country_code) values ('Unrelated matching test','unknown','uncertain','Unclassified','Not provided','https://example.test','GB') returning id`;
        const [prospect] = await tx<
          { id: string }[]
        >`insert into growth.prospects (business_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,assigned_owner_email,source_details) values (${business.id},'needs_review',0,'test','test',0,0,'j.ntagengwa@faithfulsoftware.dev',${tx.json({ email: "invalid" })}) returning id`;
        const [org] = await tx<
          { id: string }[]
        >`insert into operations.organisations (id,legal_name,display_name,trading_status,timezone,created_by,review_reference) values (gen_random_uuid(),'Different matching client','Different matching client','active','Europe/London',${"a".repeat(64)},'test') returning id`;
        await tx`insert into operations.contacts (organisation_id,name,email,created_by,review_reference) values (${org.id},'test','abc',${"a".repeat(64)},'test')`;
        await tx`set local role growth_app`;
        const [negative] = await tx<
          { matched: boolean }[]
        >`select growth.is_outreach_client(${prospect.id}) as matched`;
        assert.equal(negative.matched, false);
        await tx`reset role`;
        await tx`insert into operations.contacts (organisation_id,name,email,created_by,review_reference) values (${org.id},'test','person@match.example',${"a".repeat(64)},'test')`;
        await tx`update growth.businesses set website_url='https://www.match.example:443?ref=1' where id=${business.id}`;
        await tx`set local role growth_app`;
        const [positive] = await tx<
          { matched: boolean }[]
        >`select growth.is_outreach_client(${prospect.id}) as matched`;
        assert.equal(positive.matched, true);
        throw new Error("rollback fixture");
      })
      .catch((error: Error) => {
        if (error.message !== "rollback fixture") throw error;
      });
  } finally {
    await sql.end();
  }
});

test("job reclaim changes its lease revision", async () => {
  const sql = postgres(url, { max: 1 });
  const key = `fence-${crypto.randomUUID()}`;
  try {
    await sql`insert into growth.outreach_jobs(job_type,due_at,idempotency_key) values ('test','2000-01-01T00:00:00Z',${key})`;
    await sql`insert into growth.outreach_jobs(job_type,due_at,idempotency_key,status) values ('test','1999-01-01T00:00:00Z',${`${key}-held`},'held')`;
    const [first] = await sql<
      { id: string; revision: string }[]
    >`select id,lease_revision as revision from growth.claim_outreach_jobs(${key},1,interval '1 minute') where idempotency_key=${key}`;
    assert.equal(first?.revision, "1");
    await sql`update growth.outreach_jobs set lease_until=now()-interval '1 second' where id=${first.id}`;
    const [second] = await sql<
      { revision: string }[]
    >`select lease_revision as revision from growth.claim_outreach_jobs(${key},1,interval '1 minute') where idempotency_key=${key}`;
    assert.equal(second?.revision, "2");
    const [held] = await sql<
      { status: string; revision: string }[]
    >`select status,lease_revision as revision from growth.outreach_jobs where idempotency_key=${`${key}-held`}`;
    assert.deepEqual(held, { status: "held", revision: "0" });
  } finally {
    await sql`delete from growth.outreach_jobs where idempotency_key in (${key},${`${key}-held`})`;
    await sql.end();
  }
});
