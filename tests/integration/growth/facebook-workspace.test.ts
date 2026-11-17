import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import {
  executeFacebookCommand,
  ingestFacebookDiscovery,
} from "../../../lib/growth/facebook/service";

const url = process.env.DIRECT_DATABASE_URL;
const founder = {
  email: "j.ntagengwa@faithfulsoftware.dev",
  actorId: createHash("sha256")
    .update("j.ntagengwa@faithfulsoftware.dev")
    .digest("hex"),
};
test(
  "Facebook commands replay and discovery permits an empty run",
  { skip: !url },
  async () => {
    if (!url) return;
    const db = postgres(url, { max: 3 });
    const now = new Date();
    const command = {
      type: "capture_destination" as const,
      requestId: randomUUID(),
      destination: {
        url: `https://m.facebook.com/groups/${randomUUID()}?utm_source=x`,
        name: "Test group",
        kind: "group" as const,
        locality: null,
        websiteUrl: null,
        observation: {
          sourceUrl: "https://facebook.com/public",
          summary: "Public information",
          observedAt: now,
        },
      },
    };
    try {
      const first = await executeFacebookCommand(
        db,
        command,
        founder,
        randomUUID(),
      );
      assert.equal(
        (await executeFacebookCommand(db, command, founder, randomUUID())).id,
        first.id,
      );
      const { facebookCommandSchema } =
        await import("../../../lib/growth/facebook/contracts");
      const isoReplay = facebookCommandSchema.parse({
        ...command,
        destination: {
          ...command.destination,
          observation: {
            ...command.destination.observation,
            observedAt: now.toISOString(),
          },
        },
      });
      assert.deepEqual(
        await executeFacebookCommand(db, isoReplay, founder, randomUUID()),
        { id: first.id, alreadyExisted: true },
      );
      await assert.rejects(
        executeFacebookCommand(
          db,
          {
            ...command,
            destination: { ...command.destination, name: "Changed" },
          },
          founder,
          randomUUID(),
        ),
        /request_conflict/,
      );
      const batch = {
        version: 1 as const,
        purpose: "facebook_public_discovery" as const,
        externalRunId: randomUUID(),
        observedAt: now,
        observations: [],
      };
      assert.equal(
        (await ingestFacebookDiscovery(db, batch, "agent-a", randomUUID()))
          .count,
        0,
      );
      assert.equal(
        (await ingestFacebookDiscovery(db, batch, "agent-a", randomUUID()))
          .alreadyExisted,
        true,
      );
      await assert.rejects(
        ingestFacebookDiscovery(db, batch, "agent-b", randomUUID()),
        /request_conflict/,
      );
    } finally {
      await db.end();
    }
  },
);

test(
  "observations invalidate founder review while factual history remains writable",
  { skip: !url },
  async () => {
    if (!url) return;
    const { getFacebookWorkspace } =
      await import("../../../lib/growth/facebook/workspace");
    const db = postgres(url, { max: 3 });
    const now = new Date();
    const requestId = randomUUID();
    try {
      const created = await executeFacebookCommand(
        db,
        {
          type: "capture_destination",
          requestId,
          destination: {
            url: `https://facebook.com/groups/${randomUUID()}`,
            name: "Evidence group",
            kind: "group",
            locality: null,
            websiteUrl: null,
            observation: {
              sourceUrl: "https://facebook.com/public",
              summary: "Public",
              observedAt: now,
            },
          },
        },
        founder,
        randomUUID(),
      );
      const review = {
        type: "review_rules" as const,
        requestId: randomUUID(),
        destinationId: created.id,
        expectedVersion: 1,
        sourceUrl: "https://facebook.com/rules",
        summary: "Founder reviewed rules",
        observedAt: now,
        expiresAt: new Date(now.getTime() + 86400000),
        decision: "allowed" as const,
      };
      await executeFacebookCommand(db, review, founder, randomUUID());
      const selected = await getFacebookWorkspace(
        db,
        founder,
        new Date(),
        randomUUID(),
        null,
        created.id,
      );
      assert.equal(selected.status, "ready");
      if (selected.status === "ready") {
        assert.equal(selected.destinations.length, 1);
        assert.equal(selected.destinations[0].id, created.id);
        assert.equal(selected.destinations[0].postReadiness, "allowed");
      }
      const missing = await getFacebookWorkspace(
        db,
        founder,
        new Date(),
        randomUUID(),
        null,
        randomUUID(),
      );
      assert.equal(missing.status, "ready");
      if (missing.status === "ready")
        assert.equal(missing.destinations.length, 0);
      await assert.rejects(
        getFacebookWorkspace(
          db,
          { ...founder, actorId: "invalid" },
          new Date(),
          randomUUID(),
          null,
          created.id,
        ),
      );
      const workspace = await getFacebookWorkspace(
        db,
        founder,
        new Date(),
        randomUUID(),
      );
      assert.equal(workspace.status, "ready");
      if (workspace.status !== "ready") return;
      assert.equal(
        workspace.destinations.find((d) => d.id === created.id)?.postReadiness,
        "allowed",
      );
      await assert.rejects(
        executeFacebookCommand(
          db,
          { ...review, requestId: randomUUID() },
          founder,
          randomUUID(),
        ),
        /destination_version_changed/,
      );
      await executeFacebookCommand(
        db,
        {
          type: "capture_destination",
          requestId: randomUUID(),
          destination: {
            url: workspace.destinations.find((d) => d.id === created.id)!.url,
            name: "Evidence group",
            kind: "group",
            locality: null,
            websiteUrl: null,
            observation: {
              sourceUrl: "https://facebook.com/public",
              summary: "Changed evidence",
              observedAt: now,
            },
          },
        },
        founder,
        randomUUID(),
      );
      const updated = await getFacebookWorkspace(
        db,
        founder,
        new Date(),
        randomUUID(),
      );
      assert.equal(updated.status, "ready");
      if (updated.status === "ready")
        assert.equal(
          updated.destinations.find((d) => d.id === created.id)?.postReadiness,
          "stale",
        );
      await executeFacebookCommand(
        db,
        {
          type: "record_activity",
          requestId: randomUUID(),
          destinationId: created.id,
          activity: "posted",
          occurredAt: now,
          evidenceUrl: null,
          prospectId: null,
        },
        founder,
        randomUUID(),
      );
    } finally {
      await db.end();
    }
  },
);

test(
  "Growth role can write Facebook facts while browser roles cannot read them",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, { max: 1, connection: { role: "growth_app" } });
    try {
      const [who] = await db`select current_user as name`;
      assert.equal(who?.name, "growth_app");
      await executeFacebookCommand(
        db,
        {
          type: "capture_destination",
          requestId: randomUUID(),
          destination: {
            url: `https://facebook.com/${randomUUID()}`,
            name: "Role test",
            kind: "page",
            locality: null,
            websiteUrl: null,
            observation: {
              sourceUrl: "https://facebook.com/public",
              summary: "Public",
              observedAt: new Date(),
            },
          },
        },
        founder,
        randomUUID(),
      );
      await assert.rejects(
        admin.begin(async (tx) => {
          await tx`set local role authenticated`;
          await tx`select * from growth.facebook_destination_observations`;
        }),
        /permission denied/,
      );
    } finally {
      await db.end();
      await admin.end();
    }
  },
);

test(
  "two lifetime slots serialize and pilot revision replay is fenced",
  { skip: !url },
  async () => {
    if (!url) return;
    const { executeCrmCommand } =
      await import("../../../lib/growth/crm/commands");
    const { createPreviewChangeRequest } =
      await import("../../../lib/growth/prospect-previews/change-requests");
    const admin = postgres(url, { max: 3 });
    const db = postgres(url, { max: 5, connection: { role: "growth_app" } });
    const ids: string[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const token = randomUUID();
        const result = await executeCrmCommand(
          db,
          {
            kind: "capture_source",
            requestId: randomUUID(),
            sourceType: "facebook_page",
            sourceUrl: `https://facebook.com/${token}`,
            businessName: `Pilot ${token}`,
            countryCode: "GB",
            corporateType: null,
            registrationNumber: null,
            firstName: null,
            lastName: null,
            email: null,
            opportunity: "Review",
            offer: "Preview",
            observedAt: new Date(),
          },
          founder,
          randomUUID(),
        );
        assert.ok(result.prospectId);
        ids.push(result.prospectId);
      }
      const [business] = await admin<
        { businessId: string }[]
      >`select business_id as "businessId" from growth.prospects where id=${ids[0]!}`;
      const suppressionEmail = `${randomUUID()}@example.com`;
      await admin`insert into growth.suppressions(normalised_email,business_id,reason,source,created_by) values (${suppressionEmail},${business!.businessId},'test','test','test')`;
      await assert.rejects(
        executeFacebookCommand(
          db,
          {
            type: "allocate_pilot",
            requestId: randomUUID(),
            prospectId: ids[0]!,
            expectedVersion: 1,
          },
          founder,
          randomUUID(),
        ),
        /prospect_protected/,
      );
      await admin`delete from growth.suppressions where normalised_email=${suppressionEmail}`;
      await executeFacebookCommand(
        db,
        {
          type: "allocate_pilot",
          requestId: randomUUID(),
          prospectId: ids[0]!,
          expectedVersion: 1,
        },
        founder,
        randomUUID(),
      );
      const claims = await Promise.allSettled(
        ids.slice(1).map((prospectId) =>
          executeFacebookCommand(
            db,
            {
              type: "allocate_pilot",
              requestId: randomUUID(),
              prospectId,
              expectedVersion: 1,
            },
            founder,
            randomUUID(),
          ),
        ),
      );
      assert.equal(claims.filter((c) => c.status === "fulfilled").length, 1);
      const digest = "b".repeat(64),
        token = randomUUID().replaceAll("-", "");
      await admin`insert into growth.prospect_previews(prospect_id,public_id,status,content_snapshot,slug,composition_digest,generation_status,generation_pr_number,generation_branch,generated_at) values (${ids[0]!},${token},'draft','{}'::jsonb,${`pilot-${token}`},${digest},'pr_open',1,'generated/prospect-previews/2026-11-17',now())`;
      const request = {
        prospectId: ids[0]!,
        compositionDigest: digest,
        notes: "Review this",
        createdBy: founder.actorId,
        requestId: randomUUID(),
      };
      const raced = await Promise.all([
        createPreviewChangeRequest(request, db),
        createPreviewChangeRequest(request, db),
      ]);
      assert.deepEqual(raced[0], raced[1]);
      const first = raced[0];
      assert.ok(first);
      assert.deepEqual(await createPreviewChangeRequest(request, db), first);
      await assert.rejects(
        createPreviewChangeRequest({ ...request, notes: "Changed" }, db),
        /request_conflict/,
      );
      await assert.rejects(
        createPreviewChangeRequest({ ...request, requestId: randomUUID() }, db),
        /pilot_revision_already_requested/,
      );
      await assert.rejects(
        createPreviewChangeRequest({ ...request, requestId: undefined }, db),
        /pilot_request_id_required/,
      );
    } finally {
      await admin`delete from growth.prospect_preview_change_requests where prospect_preview_id in (select id from growth.prospect_previews where prospect_id=any(${ids}::uuid[]))`;
      await admin`delete from growth.prospect_previews where prospect_id=any(${ids}::uuid[])`;
      await admin`delete from growth.facebook_pilot_allocations where prospect_id=any(${ids}::uuid[])`;
      await db.end();
      await admin.end();
    }
  },
);

test(
  "audit notifications appear only on commit and listener closes",
  { skip: !url },
  async () => {
    if (!url) return;
    const { subscribeFacebookChanges } =
      await import("../../../lib/growth/facebook/events");
    const admin = postgres(url, { max: 2 });
    const received: string[] = [];
    const eventUrl = new URL(url);
    eventUrl.username = "growth_app";
    eventUrl.password = "";
    await admin`alter role growth_app login`;
    let subscription:
      | Awaited<ReturnType<typeof subscribeFacebookChanges>>
      | undefined;
    try {
      subscription = await subscribeFacebookChanges(eventUrl.toString(), {
        ready: () => {},
        change: (id) => received.push(id),
      });
      assert.equal(subscription.status, "listening");
      let id = "";
      await admin.begin(async (tx) => {
        const [row] = await tx<
          { id: string }[]
        >`insert into growth.audit_log(correlation_id,actor_type,actor_id,action,entity_type,entity_id,metadata) values ('test','system','test','facebook.test','facebook','test','{}') returning id`;
        id = row!.id;
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.ok(!received.includes(id));
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(received.filter((item) => item === id).length, 1);
      let rolledBack = "";
      await assert.rejects(
        admin.begin(async (tx) => {
          const [row] = await tx<
            { id: string }[]
          >`insert into growth.audit_log(correlation_id,actor_type,actor_id,action,entity_type,entity_id,metadata) values ('test','system','test','facebook.rollback','facebook','test','{}') returning id`;
          rolledBack = row!.id;
          throw new Error("rollback");
        }),
        /rollback/,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.ok(!received.includes(rolledBack));
      if (subscription.status === "listening") {
        await subscription.close();
        await subscription.close();
      }
    } finally {
      if (subscription?.status === "listening") await subscription.close();
      await admin`alter role growth_app nologin`;
      await admin.end();
    }
  },
);

test(
  "source capture links canonical prospects and rolls back invalid destination",
  { skip: !url },
  async () => {
    if (!url) return;
    const db = postgres(url, { max: 3, connection: { role: "growth_app" } });
    const now = new Date(),
      group = `https://facebook.com/groups/${randomUUID()}`;
    try {
      const dest = await executeFacebookCommand(
        db,
        {
          type: "capture_destination",
          requestId: randomUUID(),
          destination: {
            url: group,
            name: "Capture group",
            kind: "group",
            locality: null,
            websiteUrl: null,
            observation: {
              sourceUrl: group,
              summary: "Public",
              observedAt: now,
            },
          },
        },
        founder,
        randomUUID(),
      );
      const source = (name: string, requestId: string) => ({
        requestId,
        sourceType: "facebook_group" as const,
        sourceUrl: group,
        businessName: name,
        countryCode: "GB",
        corporateType: null,
        registrationNumber: null,
        firstName: null,
        lastName: null,
        email: null,
        opportunity: "Review",
        offer: "Preview",
        observedAt: now,
      });
      const requestId = randomUUID();
      const command = {
        type: "capture_source" as const,
        requestId,
        destinationId: dest.id,
        source: source(`A ${randomUUID()}`, requestId),
      };
      const first = await executeFacebookCommand(
        db,
        command,
        founder,
        randomUUID(),
      );
      assert.deepEqual(
        await executeFacebookCommand(db, command, founder, randomUUID()),
        { id: first.id, alreadyExisted: true },
      );
      const { getFacebookWorkspace } =
        await import("../../../lib/growth/facebook/workspace");
      const selected = await getFacebookWorkspace(
        db,
        founder,
        now,
        randomUUID(),
        null,
        dest.id,
      );
      const [prospect] = await db<
        { version: number }[]
      >`select version from growth.prospects where id=${first.id}::uuid`;
      assert.equal(selected.status, "ready");
      if (selected.status === "ready")
        assert.equal(
          selected.destinations[0].prospects.find(
            (item) => item.prospectId === first.id,
          )?.version,
          prospect.version,
        );
      const secondId = randomUUID();
      const second = await executeFacebookCommand(
        db,
        {
          type: "capture_source",
          requestId: secondId,
          destinationId: dest.id,
          source: source(`B ${randomUUID()}`, secondId),
        },
        founder,
        randomUUID(),
      );
      assert.notEqual(first.id, second.id);
      const badId = randomUUID(),
        name = `rollback ${randomUUID()}`;
      await assert.rejects(
        executeFacebookCommand(
          db,
          {
            type: "capture_source",
            requestId: badId,
            destinationId: randomUUID(),
            source: source(name, badId),
          },
          founder,
          randomUUID(),
        ),
        /invalid_source/,
      );
      const rows =
        await db`select id from growth.businesses where legal_name=${name}`;
      assert.equal(rows.length, 0);
    } finally {
      await db.end();
    }
  },
);

test(
  "event listener rejects a Growth role with elevated privileges",
  { skip: !url },
  async () => {
    if (!url) return;
    const { subscribeFacebookChanges } =
      await import("../../../lib/growth/facebook/events");
    const admin = postgres(url, { max: 1 });
    const eventUrl = new URL(url);
    eventUrl.username = "growth_app";
    eventUrl.password = "";
    await admin`alter role growth_app login createrole`;
    try {
      await assert.rejects(
        subscribeFacebookChanges(eventUrl.toString(), {
          ready: () => {},
          change: () => {},
        }),
        /invalid_growth_event_role/,
      );
    } finally {
      await admin`alter role growth_app nologin nocreaterole`;
      await admin.end();
    }
  },
);
