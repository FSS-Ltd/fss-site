import type { Sql, TransactionSql } from "postgres";

export type GrowthDb = Sql<Record<string, never>>;
export type GrowthTransaction = TransactionSql<Record<string, never>>;
