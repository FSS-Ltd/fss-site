import { z } from "zod";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import {
  activeStudioSettingsSchema,
  defaultActiveStudioSettings,
  studioPresentationSettingsSchema,
  studioSettingsSectionUpdateSchema,
  type ActiveStudioSettings,
  type StudioPresentationSettings,
} from "./active-settings-types";
import { approvedStudioReplyToAddresses } from "./settings-reply-to";

export class ActiveStudioSettingsConflict extends Error {
  constructor(public readonly current: ActiveStudioSettings) {
    super(
      "Another administrator applied settings. Review the current revision before applying your retained edits.",
    );
    this.name = "ActiveStudioSettingsConflict";
  }
}

/** Use inside a staff-authorized transaction. Workers have no table grants. */
export async function readActiveStudioSettings(
  tx: OperationsTransaction,
): Promise<ActiveStudioSettings> {
  const [settings] = await tx<ActiveStudioSettings[]>`
    select revision, display_name as "displayName", reply_to as "replyTo",
      timezone, response_expectation_hours as "responseExpectationHours",
      delivery_capacity as "deliveryCapacity"
    from operations.studio_settings_active
    order by revision desc limit 1
  `;
  return settings
    ? activeStudioSettingsSchema.parse(settings)
    : defaultActiveStudioSettings;
}

export async function loadActiveStudioSettings(
  db: OperationsDb,
  admin: FssAdminContext,
): Promise<ActiveStudioSettings> {
  return withFssAdminTransaction(db, admin, readActiveStudioSettings);
}

/** Call in withPortalTransaction; the function rechecks membership in this organisation. */
export async function readPortalStudioPresentationSettings(
  tx: OperationsTransaction,
  organisationId: string,
): Promise<StudioPresentationSettings> {
  const target = z.uuid().parse(organisationId);
  const [settings] = await tx<StudioPresentationSettings[]>`
    select revision, display_name as "displayName", timezone,
      response_expectation_hours as "responseExpectationHours"
    from operations.portal_studio_presentation_settings(${target})
  `;
  return studioPresentationSettingsSchema.parse(settings);
}

export async function applyActiveStudioSettings(
  db: OperationsDb,
  admin: FssAdminContext,
  input: unknown,
  correlationId: string,
  approvedReplyTo = approvedStudioReplyToAddresses(),
): Promise<ActiveStudioSettings> {
  const update = studioSettingsSectionUpdateSchema.parse(input);
  const correlation = z.uuid().parse(correlationId);
  if (update.section === "communication") {
    const replyTo = update.values.replyTo?.toLowerCase() ?? null;
    if (
      replyTo &&
      !approvedReplyTo.some((value) => value.trim().toLowerCase() === replyTo)
    ) {
      throw new z.ZodError([
        {
          code: "custom",
          message: "Choose an approved reply-to address.",
          path: ["values", "replyTo"],
        },
      ]);
    }
    update.values.replyTo = replyTo;
  }
  return withFssAdminTransaction(db, admin, async (tx) => {
    // Serialises the first apply too: there may be no row to lock yet.
    await tx`select pg_advisory_xact_lock(hashtextextended('operations.studio_settings_active', 0))`;
    const current = await readActiveStudioSettings(tx);
    if (current.revision !== update.expectedRevision)
      throw new ActiveStudioSettingsConflict(current);
    const next: ActiveStudioSettings = {
      ...current,
      ...update.values,
      revision: current.revision + 1,
    };
    const [saved] = await tx<Array<{ revision: number }>>`
      insert into operations.studio_settings_active (
        revision, display_name, reply_to, timezone, response_expectation_hours,
        delivery_capacity, applied_by, correlation_id
      ) values (
        ${next.revision}, ${next.displayName}, ${next.replyTo}, ${next.timezone},
        ${next.responseExpectationHours}, ${next.deliveryCapacity}, ${admin.actorId}, ${correlation}
      ) returning revision
    `;
    if (!saved) throw new Error("Settings were not applied.");
    await tx`
      insert into operations.studio_settings_audit (revision, section, actor_id, correlation_id, previous_settings, applied_settings)
      values (${saved.revision}, ${update.section}, ${admin.actorId}, ${correlation}, ${tx.json(current)}, ${tx.json(next)})
    `;
    return next;
  });
}
