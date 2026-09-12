import { createOperationsDb, type OperationsDb } from "../db/client";
let workerDb: OperationsDb | undefined;
export function getBillingWorkerDb(): OperationsDb {
  if (process.env.OPERATIONS_ENABLED !== "true")
    throw new Error("Operations is disabled.");
  const url = process.env.OPERATIONS_BILLING_DATABASE_URL;
  if (!url)
    throw new Error("Operations billing worker database is not configured.");
  workerDb ??= createOperationsDb(url, "operations_billing_worker", 3);
  return workerDb;
}
