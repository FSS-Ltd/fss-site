import postgres from "postgres";

import { readGrowthServerEnv } from "../config/env";
import type { GrowthDb, GrowthTransaction } from "./types";

export type { GrowthDb, GrowthTransaction } from "./types";

export function createPostgresOptions() {
  return {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  } as const;
}

type GrowthDbFactory = (
  connectionString: string,
  options: ReturnType<typeof createPostgresOptions>,
) => GrowthDb;

const defaultGrowthDbFactory: GrowthDbFactory = (connectionString, options) =>
  postgres(connectionString, options);

export function createGrowthDb(
  connectionString: string,
  factory: GrowthDbFactory = defaultGrowthDbFactory,
): GrowthDb {
  return factory(connectionString, createPostgresOptions());
}

let sharedGrowthDb: GrowthDb | undefined;

export function getGrowthDb(): GrowthDb {
  sharedGrowthDb ??= createGrowthDb(readGrowthServerEnv().databaseUrl);
  return sharedGrowthDb;
}

export async function withGrowthTransaction<T>(
  db: GrowthDb,
  operation: (tx: GrowthTransaction) => Promise<T>,
): Promise<T> {
  const result = await db.begin(async (transaction) => ({
    value: await operation(transaction),
  }));

  return result.value;
}
