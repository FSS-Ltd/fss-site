import { z } from "zod";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";
import { engagementCommandSchema } from "./engagement-command";

export type CompletedEngagementCommand = Readonly<{
  engagementId: string;
  draftId: string;
  draftVersion: number;
}>;

export class EngagementCommandConflict extends Error {
  constructor(
    message = "This engagement action changed. Reload and try again.",
  ) {
    super(message);
    this.name = "EngagementCommandConflict";
  }
}

export async function completeStaffEngagementCommand(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  rawCommand: unknown,
  correlationId: string,
): Promise<CompletedEngagementCommand> {
  const command = engagementCommandSchema.parse(rawCommand);
  const organisation = z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);

  try {
    return await withFssAdminTransaction(db, admin, async (tx) => {
      const [result] = await tx<
        Array<{
          engagementId: string;
          draftId: string;
          draftVersion: number;
        }>
      >`
        select engagement_id as "engagementId",
          draft_id as "draftId", draft_version as "draftVersion"
        from operations.complete_staff_engagement_command(
          ${organisation}, ${tx.json(command)}, ${correlationId}::uuid
        )
      `;
      if (!result) throw new Error("The engagement action returned no result.");
      return result;
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["40001", "23503", "23505", "P0001", "P0002"].includes(String(error.code))
    ) {
      throw new EngagementCommandConflict();
    }
    throw error;
  }
}
