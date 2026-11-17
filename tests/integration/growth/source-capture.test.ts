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
      const [audit] =
        await db`select count(*)::int as count from growth.audit_log where entity_id=${result.prospectId} and action='crm.capture_source'`;
      assert.equal(audit?.count, 1);
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

test(
  "Facebook variants resolve one source identity",
  { skip: !connection },
  async () => {
    if (!connection) return;
    const db = postgres(connection, { max: 4 });
    const token = randomUUID();
    const founder = {
      email: "j.ntagengwa@faithfulsoftware.dev",
      actorId: createHash("sha256")
        .update("j.ntagengwa@faithfulsoftware.dev")
        .digest("hex"),
    };
    const input = {
      kind: "capture_source" as const,
      requestId: randomUUID(),
      sourceType: "facebook_page" as const,
      sourceUrl: `https://facebook.com/${token}`,
      businessName: `variant-${token}`,
      countryCode: "GB",
      corporateType: null,
      registrationNumber: null,
      firstName: null,
      lastName: null,
      email: null,
      opportunity: "Review",
      offer: "Website",
      observedAt: new Date(),
    };
    try {
      const [a, b] = await Promise.all([
        executeCrmCommand(db, input, founder, randomUUID()),
        executeCrmCommand(
          db,
          {
            ...input,
            requestId: randomUUID(),
            sourceUrl: `https://m.facebook.com/${token}/?utm_source=test&fbclid=abc`,
          },
          founder,
          randomUUID(),
        ),
      ]);
      assert.equal(a.prospectId, b.prospectId);
      const idPage = `https://www.facebook.com/profile.php?id=${token}`;
      const idFirst = await executeCrmCommand(
        db,
        {
          ...input,
          requestId: randomUUID(),
          businessName: `profile-${token}`,
          sourceUrl: `${idPage}&utm_campaign=x`,
        },
        founder,
        randomUUID(),
      );
      const idReplay = await executeCrmCommand(
        db,
        {
          ...input,
          requestId: randomUUID(),
          businessName: `profile-${token}`,
          sourceUrl: `https://m.facebook.com/profile.php?fbclid=abc&id=${token}`,
        },
        founder,
        randomUUID(),
      );
      assert.equal(idFirst.prospectId, idReplay.prospectId);
      const otherProfile = await executeCrmCommand(
        db,
        {
          ...input,
          requestId: randomUUID(),
          businessName: `other-profile-${token}`,
          sourceUrl: `https://facebook.com/profile.php?id=other-${token}`,
        },
        founder,
        randomUUID(),
      );
      assert.notEqual(idFirst.prospectId, otherProfile.prospectId);
    } finally {
      await db.end();
    }
  },
);

test(
  "registration identity is shared with legacy and global intake",
  { skip: !connection },
  async () => {
    if (!connection) return;
    const db = postgres(connection, { max: 4 });
    const token = randomUUID().replaceAll("-", "");
    const registration = token.slice(0, 8).toUpperCase();
    const founder = {
      email: "j.ntagengwa@faithfulsoftware.dev",
      actorId: createHash("sha256")
        .update("j.ntagengwa@faithfulsoftware.dev")
        .digest("hex"),
    };
    const source = {
      kind: "capture_source" as const,
      requestId: randomUUID(),
      sourceType: "facebook_page" as const,
      sourceUrl: `https://facebook.com/${token}`,
      businessName: `identity-${token}`,
      countryCode: "GB",
      corporateType: null,
      registrationNumber: registration,
      firstName: null,
      lastName: null,
      email: null,
      opportunity: "Review",
      offer: "Website",
      observedAt: new Date(),
    };
    const legacy = {
      kind: "capture" as const,
      requestId: randomUUID(),
      businessName: source.businessName,
      companyNumber: registration,
      countryCode: "GB",
      corporateType: "limited_company" as const,
      sector: "Services",
      locality: "London",
      sourceUrl: "https://example.com/contact",
      websiteUrl: null,
      opportunitySummary: "Review",
      recommendedOffer: "Website",
      oneOffMinPence: 0,
      oneOffMaxPence: 0,
      monthlyPence: 0,
    };
    try {
      const result = await executeCrmCommand(db, source, founder, randomUUID());
      await assert.rejects(
        executeCrmCommand(db, legacy, founder, randomUUID()),
        (error: unknown) =>
          error instanceof Error &&
          "code" in error &&
          error.code === "duplicate",
      );
      const { createGlobalResearchFixture } =
        await import("../../../lib/growth/research/global-test-fixture");
      const { ingestResearchRun } =
        await import("../../../lib/growth/research/ingest");
      const { globalResearchRunSchema } =
        await import("../../../lib/growth/research/global-schema");
      const run = globalResearchRunSchema.parse(createGlobalResearchFixture());
      run.externalRunId = token;
      const candidate = run.prospects[0]!;
      candidate.business.countryCode = "GB";
      candidate.business.companyNumber = registration;
      candidate.business.legalName = source.businessName;
      candidate.business.websiteUrl = `https://${token}.example.com`;
      candidate.business.firstPartySourceUrl = `${candidate.business.websiteUrl}/contact`;
      candidate.contact.email = `${token}@gmail.com`;
      candidate.contact.emailSourceUrl = candidate.business.firstPartySourceUrl;
      candidate.evidence[0]!.sourceUrl = candidate.business.firstPartySourceUrl;
      assert.equal((await ingestResearchRun(db, run)).duplicates, 1);
      assert.ok(result.prospectId);
      const [row] =
        await db`select b.company_number, p.source_details->>'registrationNumber' as registration from growth.prospects p join growth.businesses b on b.id=p.business_id where p.id=${result.prospectId}`;
      assert.equal(row?.company_number, null);
      assert.equal(row?.registration, registration);
      const other = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
      const first = await executeCrmCommand(
        db,
        {
          ...legacy,
          requestId: randomUUID(),
          companyNumber: other,
          businessName: `legacy-${token}`,
        },
        founder,
        randomUUID(),
      );
      const next = await executeCrmCommand(
        db,
        {
          ...source,
          requestId: randomUUID(),
          registrationNumber: other,
          businessName: `legacy-${token}`,
          sourceUrl: `https://facebook.com/legacy-${token}`,
        },
        founder,
        randomUUID(),
      );
      assert.equal(first.prospectId, next.prospectId);
      const globalReg = randomUUID()
        .replaceAll("-", "")
        .slice(0, 8)
        .toUpperCase();
      const secondRun = structuredClone(run);
      secondRun.externalRunId = `global-${token}`;
      secondRun.prospects[0]!.business.companyNumber = globalReg;
      secondRun.prospects[0]!.business.legalName = `global-${token}`;
      secondRun.prospects[0]!.business.websiteUrl = `https://global-${token}.example.com`;
      secondRun.prospects[0]!.business.firstPartySourceUrl = `https://global-${token}.example.com/contact`;
      secondRun.prospects[0]!.contact.email = `global-${token}@gmail.com`;
      secondRun.prospects[0]!.contact.emailSourceUrl =
        secondRun.prospects[0]!.business.firstPartySourceUrl;
      secondRun.prospects[0]!.evidence[0]!.sourceUrl =
        secondRun.prospects[0]!.business.firstPartySourceUrl;
      const globalFirst = await ingestResearchRun(db, secondRun);
      const afterGlobal = await executeCrmCommand(
        db,
        {
          ...source,
          requestId: randomUUID(),
          registrationNumber: globalReg,
          businessName: `global-${token}`,
          sourceUrl: `https://facebook.com/global-${token}`,
        },
        founder,
        randomUUID(),
      );
      assert.equal(
        afterGlobal.prospectId,
        globalFirst.acceptedProspects[0]?.prospectId,
      );
      const raceReg = randomUUID()
        .replaceAll("-", "")
        .slice(0, 8)
        .toUpperCase();
      const raceName = `race-${token}`;
      const race = await Promise.allSettled([
        executeCrmCommand(
          db,
          {
            ...source,
            requestId: randomUUID(),
            registrationNumber: raceReg,
            businessName: raceName,
            sourceUrl: `https://facebook.com/race-${token}`,
          },
          founder,
          randomUUID(),
        ),
        executeCrmCommand(
          db,
          {
            ...legacy,
            requestId: randomUUID(),
            companyNumber: raceReg,
            businessName: raceName,
          },
          founder,
          randomUUID(),
        ),
      ]);
      assert.ok(race.some((result) => result.status === "fulfilled"));
      const [raceCount] =
        await db`select count(*)::int as count from growth.businesses where legal_name=${raceName}`;
      assert.equal(raceCount?.count, 1);
      const globalRaceReg = randomUUID()
        .replaceAll("-", "")
        .slice(0, 8)
        .toUpperCase();
      const globalRaceName = `global-race-${token}`;
      const raceRun = structuredClone(secondRun);
      raceRun.externalRunId = globalRaceName;
      raceRun.prospects[0]!.business.companyNumber = globalRaceReg;
      raceRun.prospects[0]!.business.legalName = globalRaceName;
      raceRun.prospects[0]!.business.websiteUrl = `https://${globalRaceName}.example.com`;
      raceRun.prospects[0]!.business.firstPartySourceUrl = `https://${globalRaceName}.example.com/contact`;
      raceRun.prospects[0]!.contact.email = `${globalRaceName}@gmail.com`;
      raceRun.prospects[0]!.contact.emailSourceUrl =
        raceRun.prospects[0]!.business.firstPartySourceUrl;
      raceRun.prospects[0]!.evidence[0]!.sourceUrl =
        raceRun.prospects[0]!.business.firstPartySourceUrl;
      const globalRace = await Promise.allSettled([
        executeCrmCommand(
          db,
          {
            ...source,
            requestId: randomUUID(),
            registrationNumber: globalRaceReg,
            businessName: globalRaceName,
            sourceUrl: `https://facebook.com/${globalRaceName}`,
          },
          founder,
          randomUUID(),
        ),
        ingestResearchRun(db, raceRun),
      ]);
      assert.ok(globalRace.every((entry) => entry.status === "fulfilled"));
      const [globalRaceCount] =
        await db`select count(*)::int as count from growth.businesses where legal_name=${globalRaceName}`;
      assert.equal(globalRaceCount?.count, 1);
      const orphanReg = randomUUID()
        .replaceAll("-", "")
        .slice(0, 8)
        .toUpperCase();
      const [orphan] = await db<
        { id: string }[]
      >`insert into growth.businesses (legal_name,company_number,country_code,corporate_type,corporate_status,sector,locality,county,first_party_source_url,verified_at) values (${`orphan-${token}`},${orphanReg},'GB','unknown','uncertain','Unclassified','Not provided',null,'https://example.com',null) returning id`;
      const attached = await executeCrmCommand(
        db,
        {
          ...source,
          requestId: randomUUID(),
          registrationNumber: orphanReg,
          businessName: `orphan-${token}`,
          sourceUrl: `https://facebook.com/orphan-${token}`,
        },
        founder,
        randomUUID(),
      );
      assert.ok(attached.prospectId);
      const [attachedRow] =
        await db`select business_id from growth.prospects where id=${attached.prospectId}`;
      assert.equal(attachedRow?.business_id, orphan?.id);
    } finally {
      await db.end();
    }
  },
);
