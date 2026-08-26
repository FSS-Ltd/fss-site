import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

import { findBusinessIdentityByCompanyNumber } from "../../../lib/growth/db/repositories/businesses";
import { findContactIdentityByEmail } from "../../../lib/growth/db/repositories/contacts";
import { findProspectSummaryById } from "../../../lib/growth/db/repositories/prospects";

const connectionString = process.env.DIRECT_DATABASE_URL;

test(
  "foundation repositories execute against PostgreSQL",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 1 });

    try {
      await sql.begin(async (transaction) => {
        const [business] = await transaction<{ id: string }[]>`
          insert into growth.businesses (
            legal_name,
            company_number,
            corporate_type,
            corporate_status,
            sector,
            locality,
            county,
            first_party_source_url,
            verified_at
          ) values (
            'Repository Test Limited',
            '87654321',
            'limited_company',
            'active',
            'Technology',
            'Canterbury',
            'Kent',
            'https://example.test/repository-business',
            now()
          )
          returning id
        `;

        const [contact] = await transaction<{ id: string }[]>`
          insert into growth.contacts (
            business_id,
            first_name,
            last_name,
            email,
            email_source_url,
            email_verified_at,
            subscriber_type,
            lawful_basis
          ) values (
            ${business.id},
            'Ada',
            'Lovelace',
            'repository-contact@example.test',
            'https://example.test/repository-contact',
            now(),
            'corporate',
            'legitimate_interests'
          )
          returning id
        `;

        const [blankNameContact] = await transaction<{ id: string }[]>`
          insert into growth.contacts (
            business_id,
            first_name,
            last_name,
            email,
            email_source_url,
            email_verified_at,
            subscriber_type,
            lawful_basis
          ) values (
            ${business.id},
            ' ',
            '',
            'repository-blank-name@example.test',
            'https://example.test/repository-blank-name',
            now(),
            'corporate',
            'legitimate_interests'
          )
          returning id
        `;

        const [singleNameContact] = await transaction<{ id: string }[]>`
          insert into growth.contacts (
            business_id,
            first_name,
            last_name,
            email,
            email_source_url,
            email_verified_at,
            subscriber_type,
            lawful_basis
          ) values (
            ${business.id},
            'Grace',
            ' ',
            'repository-single-name@example.test',
            'https://example.test/repository-single-name',
            now(),
            'corporate',
            'legitimate_interests'
          )
          returning id
        `;

        const [prospect] = await transaction<{ id: string }[]>`
          insert into growth.prospects (
            business_id,
            primary_contact_id,
            status,
            fit_score,
            opportunity_summary,
            recommended_offer,
            estimated_one_off_min_pence,
            estimated_one_off_max_pence,
            next_action,
            assigned_owner_email
          ) values (
            ${business.id},
            ${contact.id},
            'qualified',
            91,
            'Repository integration test',
            'Growth OS',
            100000,
            200000,
            'Review first email',
            'j.ntagengwa@faithfulsoftware.dev'
          )
          returning id
        `;

        const insertClosedProspect = async (
          primaryContactId: string | null,
          summary: string,
        ): Promise<string> => {
          const [row] = await transaction<{ id: string }[]>`
            insert into growth.prospects (
              business_id,
              primary_contact_id,
              status,
              fit_score,
              opportunity_summary,
              recommended_offer,
              estimated_one_off_min_pence,
              estimated_one_off_max_pence,
              assigned_owner_email
            ) values (
              ${business.id},
              ${primaryContactId},
              'lost',
              0,
              ${summary},
              'Growth OS',
              0,
              0,
              'j.ntagengwa@faithfulsoftware.dev'
            )
            returning id
          `;

          return row.id;
        };

        const noContactProspectId = await insertClosedProspect(
          null,
          "No contact",
        );
        const blankNameProspectId = await insertClosedProspect(
          blankNameContact.id,
          "Blank contact name",
        );
        const singleNameProspectId = await insertClosedProspect(
          singleNameContact.id,
          "Single contact name",
        );

        const businessIdentity = await findBusinessIdentityByCompanyNumber(
          transaction,
          " 87 65 43 21 ",
        );
        const contactIdentity = await findContactIdentityByEmail(
          transaction,
          " Repository-Contact@Example.Test ",
        );
        const prospectSummary = await findProspectSummaryById(
          transaction,
          prospect.id,
        );
        const noContactSummary = await findProspectSummaryById(
          transaction,
          noContactProspectId,
        );
        const blankNameSummary = await findProspectSummaryById(
          transaction,
          blankNameProspectId,
        );
        const singleNameSummary = await findProspectSummaryById(
          transaction,
          singleNameProspectId,
        );

        assert.equal(businessIdentity?.id, business.id);
        assert.equal(businessIdentity?.legalName, "Repository Test Limited");
        assert.equal(contactIdentity?.id, contact.id);
        assert.equal(contactIdentity?.businessId, business.id);
        assert.equal(prospectSummary?.businessName, "Repository Test Limited");
        assert.equal(prospectSummary?.contactName, "Ada Lovelace");
        assert.equal(prospectSummary?.fitScore, 91);
        assert.equal(noContactSummary?.contactName, null);
        assert.equal(blankNameSummary?.contactName, null);
        assert.equal(singleNameSummary?.contactName, "Grace");

        await transaction`
          delete from growth.prospect_previews
          where prospect_id in (
            select id from growth.prospects where business_id = ${business.id}
          )
        `;
        await transaction`
          delete from growth.prospects where business_id = ${business.id}
        `;
        await transaction`
          delete from growth.contacts where business_id = ${business.id}
        `;
        await transaction`
          delete from growth.businesses where id = ${business.id}
        `;
      });
    } finally {
      await sql.end();
    }
  },
);
