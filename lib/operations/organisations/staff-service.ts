import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currencySchema, type Currency } from "../money";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";

const conciseText = z.string().trim().min(1).max(200);
const emailAddress = z.string().trim().toLowerCase().email().max(254);
const timezone = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .superRefine((value, context) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
    } catch {
      context.addIssue({
        code: "custom",
        message: "Choose a valid IANA time zone.",
      });
    }
  });

export const staffClientCreationSchema = z.strictObject({
  billingCurrency: currencySchema.default("GBP"),
  displayName: conciseText,
  legalName: conciseText,
  primaryContact: z.strictObject({
    email: emailAddress,
    name: conciseText,
    role: conciseText,
  }),
  reviewReference: conciseText,
  timezone,
});

export type StaffClientCreation = z.infer<typeof staffClientCreationSchema>;

export class StudioClientDuplicateError extends Error {
  constructor() {
    super(
      "A client with the same display or legal name already exists. Review the client register before saving.",
    );
  }
}

function duplicateLockKey(client: StaffClientCreation): string {
  return [client.displayName.toLowerCase(), client.legalName.toLowerCase()]
    .sort()
    .join("\u0000");
}

export async function createStaffClient(
  db: OperationsDb,
  admin: FssAdminContext,
  raw: unknown,
  correlationId: string,
): Promise<{ organisationId: string }> {
  const client = staffClientCreationSchema.parse(raw);
  z.uuid().parse(correlationId);

  return withFssAdminTransaction(db, admin, async (tx) => {
    // Serialise equivalent name checks because the register predates a unique
    // name constraint and duplicate candidates must be rejected before insert.
    await tx`select pg_advisory_xact_lock(hashtextextended(${duplicateLockKey(client)}, 0))`;
    const [existing] = await tx<{ id: string }[]>`
      select id
      from operations.organisations
      where lower(display_name) = lower(${client.displayName})
        or lower(legal_name) = lower(${client.legalName})
      limit 1
    `;
    if (existing) throw new StudioClientDuplicateError();

    const [organisation] = await tx<{ id: string }[]>`
      insert into operations.organisations (
        id, legal_name, display_name, trading_status, timezone, created_by, review_reference, billing_currency
      ) values (
        ${randomUUID()}, ${client.legalName}, ${client.displayName}, 'unknown',
        ${client.timezone}, ${admin.actorId}, ${client.reviewReference}, ${client.billingCurrency}
      )
      returning id
    `;
    if (!organisation)
      throw new Error(
        "The client record could not be created. Please try again.",
      );

    await tx`
      insert into operations.contacts (
        organisation_id, name, email, job_title, created_by, review_reference
      ) values (
        ${organisation.id}, ${client.primaryContact.name}, ${client.primaryContact.email},
        ${client.primaryContact.role}, ${admin.actorId}, ${client.reviewReference}
      )
    `;

    return { organisationId: organisation.id };
  });
}

export const staffClientCurrencySchema = z.strictObject({
  billingCurrency: currencySchema,
  expectedCurrencyVersion: z.number().int().min(1).max(2_147_483_646),
  reviewReference: conciseText,
});

export type StaffClientCurrencyResult = Readonly<{
  organisationId: string;
  billingCurrency: Currency;
  currencyVersion: number;
}>;

export class StudioClientCurrencyConflict extends Error {
  constructor() {
    super(
      "This client's currency changed or the client is unavailable. Reload before saving again.",
    );
    this.name = "StudioClientCurrencyConflict";
  }
}

export async function updateStaffClientCurrency(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<StaffClientCurrencyResult> {
  const input = staffClientCurrencySchema.parse(raw);
  const id = z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  try {
    return await withFssAdminTransaction(db, admin, async (tx) => {
      const [result] = await tx<StaffClientCurrencyResult[]>`
        select organisation_id as "organisationId", billing_currency as "billingCurrency",
          currency_version as "currencyVersion"
        from operations.update_client_currency(${id}, ${input.billingCurrency},
          ${input.expectedCurrencyVersion}, ${input.reviewReference}, ${correlationId}::uuid)
      `;
      if (!result) throw new Error("The currency change returned no result.");
      return result;
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "40001"
    ) {
      throw new StudioClientCurrencyConflict();
    }
    throw error;
  }
}
