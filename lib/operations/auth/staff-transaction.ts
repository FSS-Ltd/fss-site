import type { OperationsDb, OperationsTransaction } from "../db/client";
import type { FssAdminContext } from "./staff-types";

export async function withFssAdminTransaction<T>(
  db: OperationsDb,
  admin: FssAdminContext,
  run: (tx: OperationsTransaction) => Promise<T>,
): Promise<T> {
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.user_id', ${admin.userId}, true),
      set_config('operations.actor_id', ${admin.actorId}, true),
      set_config('operations.correlation_id', ${admin.correlationId}, true)`;
    await tx`select operations.assert_active_staff_membership()`;
    return { value: await run(tx) };
  });
  return result.value;
}
