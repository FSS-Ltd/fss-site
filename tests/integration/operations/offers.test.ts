import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import {
  insertOfferEnquiry,
  listPublishedOffers,
} from "../../../lib/operations/offers/repository";
import {
  createDeliveryFixture,
  removeDeliveryFixture,
} from "./project-document-fixtures";

const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);

test("portal hides drafts, deduplicates enquiries and preserves tenant and payment boundaries", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const first = await createDeliveryFixture(admin, founder);
  const second = await createDeliveryFixture(admin, founder);
  const [draft, published] = await admin<
    { id: string }[]
  >`insert into operations.offers(name,outcome,audience,pricing_display,status) values('Draft service','Draft outcome','Clients','quote','draft'),('Published service','A clear result','Clients','quote','published') returning id`;
  const key = randomUUID();
  try {
    const offers = await listPublishedOffers(
      portal,
      first.identity,
      first.organisationId,
      first.correlationId,
    );
    assert.deepEqual(
      offers.map((offer) => offer.id),
      [published.id],
    );
    assert.equal(
      offers.some((offer) => offer.id === draft.id),
      false,
    );
    const command = {
      offerId: published.id,
      idempotencyKey: key,
      interest: "Please review this need.",
      context: {},
    };
    const id = await insertOfferEnquiry(
      portal,
      first.identity,
      first.organisationId,
      first.correlationId,
      command,
    );
    assert.equal(
      await insertOfferEnquiry(
        portal,
        first.identity,
        first.organisationId,
        first.correlationId,
        command,
      ),
      id,
    );
    await assert.rejects(
      insertOfferEnquiry(
        portal,
        first.identity,
        second.organisationId,
        first.correlationId,
        { ...command, idempotencyKey: randomUUID() },
      ),
    );
    const [counts] = await admin<
      { enquiries: number; commands: number }[]
    >`select (select count(*)::integer from operations.offer_enquiries where id=${id}) as enquiries,(select count(*)::integer from operations.billing_commands where organisation_id=${first.organisationId}) as commands`;
    assert.deepEqual(counts, { enquiries: 1, commands: 0 });
  } finally {
    await admin`delete from operations.offer_enquiries where offer_id in (${draft.id},${published.id})`;
    await admin`delete from operations.offers where id in (${draft.id},${published.id})`;
    await removeDeliveryFixture(admin, first);
    await removeDeliveryFixture(admin, second);
    await portal.end();
    await founder.end();
    await admin.end();
  }
});
