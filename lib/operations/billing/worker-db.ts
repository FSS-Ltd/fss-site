import postgres from "postgres";
import type { OperationsDb } from "../db/client";
let workerDb: OperationsDb | undefined;
export function getBillingWorkerDb(): OperationsDb {
  if (process.env.OPERATIONS_ENABLED !== "true")
    throw new Error("Operations is disabled.");
  const url = process.env.OPERATIONS_BILLING_DATABASE_URL;
  if (!url)
    throw new Error("Operations billing worker database is not configured.");
  workerDb ??= postgres(url, {
    connection: { options: "-c role=operations_billing_worker" },
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return workerDb;
}
