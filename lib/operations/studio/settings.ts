import { z } from "zod";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import { readBillingConfiguration } from "../billing/configuration";
import type { OperationsDb } from "../db/client";

const capacitySchema = z.enum(["standard", "limited", "priority"]);
const draftSchema = z.strictObject({
  deliveryCapacity: capacitySchema,
  displayName: z.string().trim().min(1).max(160),
  expectedRevision: z.coerce.number().int().min(0),
  replyTo: z.string().trim().email().max(254).nullable(),
  responseExpectationHours: z.coerce.number().int().min(1).max(168),
  timezone: z.string().trim().min(1).max(100).refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid IANA timezone."),
});

export type StudioSettingsDraft = Readonly<{
  revision: number;
  displayName: string;
  replyTo: string | null;
  timezone: string;
  responseExpectationHours: number;
  deliveryCapacity: z.infer<typeof capacitySchema>;
  createdAt: string;
}>;

export type StudioIntegrationHealth = Readonly<{
  name: "Authentication" | "Email" | "Signing" | "Billing" | "File scanning";
  available: boolean;
  detail: string;
}>;

export type StudioSettings = Readonly<{
  draft: StudioSettingsDraft | null;
  approvedReplyTo: readonly string[];
  integrationHealth: readonly StudioIntegrationHealth[];
}>;

type SettingsRow = StudioSettingsDraft;

export class StudioSettingsConflict extends Error {
  constructor() {
    super("This settings draft changed. Refresh before saving another revision.");
    this.name = "StudioSettingsConflict";
  }
}

function billingAvailable(): boolean {
  try {
    return readBillingConfiguration().enabled;
  } catch {
    return false;
  }
}

/** Deployment controls are read-only health signals, never form inputs. */
export function studioIntegrationHealth(): readonly StudioIntegrationHealth[] {
  return [
    {
      available: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") === true,
      detail: "Identity is managed by the portal deployment.",
      name: "Authentication",
    },
    {
      available: process.env.OPERATIONS_REQUEST_EMAILS_ENABLED === "true",
      detail: "Request email delivery is deployment-managed.",
      name: "Email",
    },
    {
      available: process.env.OPERATIONS_SIGNING_ENABLED === "true",
      detail: "Agreement signing uses retained approval evidence.",
      name: "Signing",
    },
    {
      available: billingAvailable(),
      detail: "Billing remains provider-owned.",
      name: "Billing",
    },
    {
      available: process.env.OPERATIONS_DOCUMENT_SCANNING_ENABLED === "true",
      detail: "File safety status is supplied by the scanning worker.",
      name: "File scanning",
    },
  ];
}

/** No sender identity is sourced from runtime secrets or browser input. */
export function approvedStudioReplyToAddresses(): readonly string[] {
  return [];
}

export async function loadStudioSettings(
  db: OperationsDb,
  admin: FssAdminContext,
): Promise<StudioSettings> {
  return withFssAdminTransaction(db, admin, async (tx) => {
    const [draft] = await tx<SettingsRow[]>`
      select revision, display_name as "displayName", reply_to as "replyTo",
        timezone, response_expectation_hours as "responseExpectationHours",
        delivery_capacity as "deliveryCapacity", created_at::text as "createdAt"
      from operations.studio_settings_drafts
      order by revision desc
      limit 1
    `;
    return {
      approvedReplyTo: approvedStudioReplyToAddresses(),
      draft: draft ?? null,
      integrationHealth: studioIntegrationHealth(),
    };
  });
}

function normalisedApprovedReplyTo(values: readonly string[]): Set<string> {
  return new Set(values.map((value) => value.trim().toLowerCase()));
}

export async function saveStudioSettingsDraft(
  db: OperationsDb,
  admin: FssAdminContext,
  input: unknown,
  correlationId: string,
  approvedReplyTo = approvedStudioReplyToAddresses(),
): Promise<Pick<StudioSettingsDraft, "revision" | "createdAt">> {
  const draft = draftSchema.parse(input);
  const correlation = z.uuid().parse(correlationId);
  const replyTo = draft.replyTo?.toLowerCase() ?? null;
  if (replyTo && !normalisedApprovedReplyTo(approvedReplyTo).has(replyTo)) {
    throw new z.ZodError([
      {
        code: "custom",
        input: replyTo,
        message: "Choose an approved reply-to address.",
        path: ["replyTo"],
      },
    ]);
  }
  return withFssAdminTransaction(db, admin, async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('operations.studio_settings_drafts', 0))`;
    const [latest] = await tx<Array<{ revision: number }>>`
      select revision from operations.studio_settings_drafts
      order by revision desc
      limit 1
      for update
    `;
    const currentRevision = latest?.revision ?? 0;
    if (currentRevision !== draft.expectedRevision) throw new StudioSettingsConflict();
    const [saved] = await tx<Array<{ revision: number; createdAt: string }>>`
      insert into operations.studio_settings_drafts (
        revision, display_name, reply_to, timezone, response_expectation_hours,
        delivery_capacity, created_by, correlation_id
      ) values (
        ${currentRevision + 1}, ${draft.displayName}, ${replyTo}, ${draft.timezone},
        ${draft.responseExpectationHours}, ${draft.deliveryCapacity}, ${admin.actorId}, ${correlation}
      )
      returning revision, created_at::text as "createdAt"
    `;
    if (!saved) throw new Error("Settings draft was not recorded.");
    return saved;
  });
}
