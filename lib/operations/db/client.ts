import postgres from "postgres";
import type { Sql, TransactionSql } from "postgres";

export type OperationsDb = Sql<Record<string, never>>;
export type OperationsTransaction = TransactionSql<Record<string, never>>;
let sharedDb: OperationsDb | undefined;

export function operationsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.OPERATIONS_ENABLED === "true";
}

export function getOperationsDb(): OperationsDb {
  if (!operationsEnabled()) throw new Error("Operations is disabled.");
  const url = process.env.OPERATIONS_DATABASE_URL;
  if (!url) throw new Error("Operations database is not configured.");
  sharedDb ??= postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return sharedDb;
}
