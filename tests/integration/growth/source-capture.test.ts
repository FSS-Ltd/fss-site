import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { executeCrmCommand } from "../../../lib/growth/crm/commands";
import {
  getProspectListResult,
  parseProspectListQuery,
} from "../../../lib/growth/dashboard/prospects";

const connection = process.env.DIRECT_DATABASE_URL;
test(
  "source capture is review-only, idempotent and filterable",
  { skip: !connection },
  async () => {
    if (!connection) return;
    const db = postgres(connection, { max: 4 });
    const token = randomUUID();
    const founder = {
      actorId: createHash("sha256")
        .update("j.ntagengwa@faithfulsoftware.dev")
        .digest("hex"),
      email: "j.ntagengwa@faithfulsoftware.dev",
    };
    const input = {
      kind: "capture_source" as const,
      requestId: randomUUID(),
      sourceType: "facebook_page" as const,
      sourceUrl: `https://facebook.com/${token}`,
      businessName: `source-${token}`,
      countryCode: "GB",
      corporateType: null,
      registrationNumber: null,
      firstName: null,
      lastName: null,
      email: null,
      opportunity: "Review website",
      offer: "Website",
      observedAt: new Date(),
    };
    try {
      const [before] =
        await db`select (select md5(coalesce(string_agg(row_to_json(s)::text, '' order by s.id), '')) from growth.suppressions s) as suppressions, (select md5(coalesce(string_agg(row_to_json(c)::text, '' order by c.id), '')) from operations.contacts c) as clients, (select md5(coalesce(string_agg(row_to_json(o)::text, '' order by row_to_json(o)::text), '')) from operations.organisations o) as organisations, (select md5(coalesce(string_agg(row_to_json(e)::text, '' order by row_to_json(e)::text), '')) from operations.engagement_links e) as links`;
      const [result, concurrent] = await Promise.all([
        executeCrmCommand(db, input, founder, randomUUID()),
        executeCrmCommand(
          db,
          { ...input, requestId: randomUUID() },
          founder,
          randomUUID(),
        ),
      ]);
      assert.equal(concurrent.prospectId, result.prospectId);
      assert.ok(result.prospectId);
      assert.equal(
        (await executeCrmCommand(db, input, founder, randomUUID())).prospectId,
        result.prospectId,
      );
      assert.equal(
        (
          await executeCrmCommand(
            db,
            { ...input, requestId: randomUUID() },
            founder,
            randomUUID(),
          )
        ).prospectId,
        result.prospectId,
      );
      const groupUrl = `https://facebook.com/groups/${token}`;
      const [groupA, groupB] = await Promise.all([
        executeCrmCommand(
          db,
          {
            ...input,
            requestId: randomUUID(),
            sourceType: "facebook_group",
            sourceUrl: groupUrl,
            businessName: `group-a-${token}`,
          },
          founder,
          randomUUID(),
        ),
        executeCrmCommand(
          db,
          {
            ...input,
            requestId: randomUUID(),
            sourceType: "facebook_group",
            sourceUrl: groupUrl,
            businessName: `group-b-${token}`,
          },
          founder,
          randomUUID(),
        ),
      ]);
      assert.notEqual(groupA.prospectId, groupB.prospectId);
      const [row] =
        await db`select p.status, p.primary_contact_id, p.source_type, b.verified_at from growth.prospects p join growth.businesses b on b.id=p.business_id where p.id=${result.prospectId}`;
      assert.equal(row?.status, "needs_review");
      assert.equal(row?.primary_contact_id, null);
      assert.equal(row?.verified_at, null);
      assert.equal(row?.source_type, "facebook_page");
      const [counts] =
        await db`select (select count(*)::int from growth.contacts where business_id=(select business_id from growth.prospects where id=${result.prospectId})) as contacts, (select count(*)::int from growth.source_evidence where prospect_id=${result.prospectId}) as evidence`;
      assert.equal(counts?.contacts, 0);
      assert.equal(counts?.evidence, 0);
      await assert.rejects(
        executeCrmCommand(
          db,
          {
            ...input,
            requestId: randomUUID(),
            businessName: "Ambiguous identity",
          },
          founder,
          randomUUID(),
        ),
      );
      const list = await getProspectListResult(
        parseProspectListQuery({ q: token, source: "facebook_page" }),
        db,
      );
      assert.equal(list.status, "ready");
      if (list.status === "ready") assert.equal(list.data.totalCount, 1);
      const otherSource = await getProspectListResult(
        parseProspectListQuery({ q: token, source: "research" }),
        db,
      );
      assert.equal(otherSource.status, "ready");
      if (otherSource.status === "ready")
        assert.equal(otherSource.data.totalCount, 0);
      const [after] =
        await db`select (select md5(coalesce(string_agg(row_to_json(s)::text, '' order by s.id), '')) from growth.suppressions s) as suppressions, (select md5(coalesce(string_agg(row_to_json(c)::text, '' order by c.id), '')) from operations.contacts c) as clients, (select md5(coalesce(string_agg(row_to_json(o)::text, '' order by row_to_json(o)::text), '')) from operations.organisations o) as organisations, (select md5(coalesce(string_agg(row_to_json(e)::text, '' order by row_to_json(e)::text), '')) from operations.engagement_links e) as links`;
      assert.deepEqual(after, before);
      await assert.rejects(
        executeCrmCommand(
          db,
          { ...input, requestId: randomUUID(), sourceUrl: "http://127.0.0.1" },
          founder,
          randomUUID(),
        ),
      );
      await assert.rejects(
        executeCrmCommand(
          db,
          {
            ...input,
            requestId: randomUUID(),
            observedAt: new Date(Date.now() + 86400000),
          },
          founder,
          randomUUID(),
        ),
      );
      await assert.rejects(
        executeCrmCommand(
          db,
          { ...input, requestId: randomUUID() },
          { ...founder, actorId: "bad" },
          randomUUID(),
        ),
      );
    } finally {
      await db.end();
    }
  },
);
