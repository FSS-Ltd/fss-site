import { randomUUID } from "node:crypto";
import { z } from "zod";
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
        id, legal_name, display_name, trading_status, timezone, created_by, review_reference
      ) values (
        ${randomUUID()}, ${client.legalName}, ${client.displayName}, 'unknown',
        ${client.timezone}, ${admin.actorId}, ${client.reviewReference}
      )
      returning id
    `;
    if (!organisation)
      throw new Error("The client record could not be created. Please try again.");

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
