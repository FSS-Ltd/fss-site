import postgres from "postgres";
import type { Sql, TransactionSql } from "postgres";

type RawOperationsDb = Sql<Record<string, never>>;
export const operationsDatabaseRoles = [
  "operations_founder",
  "operations_portal",
  "operations_billing_worker",
  "operations_signing_worker",
  "operations_onboarding_worker",
] as const;
export type OperationsDatabaseRole = (typeof operationsDatabaseRoles)[number];
export type OperationsDb = RawOperationsDb;
export type OperationsTransaction = TransactionSql<Record<string, never>>;
let sharedDb: OperationsDb | undefined;

const localRoleStatements: Record<OperationsDatabaseRole, string> = {
  operations_founder: "set local role operations_founder",
  operations_portal: "set local role operations_portal",
  operations_billing_worker: "set local role operations_billing_worker",
  operations_signing_worker: "set local role operations_signing_worker",
  operations_onboarding_worker: "set local role operations_onboarding_worker",
};

type TransactionRunner = (tx: OperationsTransaction) => Promise<unknown>;

function isTransactionRunner(value: unknown): value is TransactionRunner {
  return typeof value === "function";
}

export async function runWithOperationsRole<T>(
  role: OperationsDatabaseRole,
  transaction: { unsafe(statement: string): unknown },
  run: () => Promise<T>,
): Promise<T> {
  await transaction.unsafe(localRoleStatements[role]);
  return run();
}

function scopeOperationsDb(
  db: RawOperationsDb,
  role: OperationsDatabaseRole,
): OperationsDb {
  return new Proxy(db, {
    apply(target, _thisArg, argumentsList) {
      return target.begin(async (tx) =>
        runWithOperationsRole(role, tx, async () =>
          Reflect.apply(tx, tx, argumentsList),
        ),
      );
    },
    get(target, property, receiver) {
      if (property === "begin") {
        return (...argumentsList: unknown[]) => {
          const callback = argumentsList.at(-1);
          if (!isTransactionRunner(callback))
            return Reflect.get(target, property, receiver);
          const scopedArguments = [...argumentsList];
          scopedArguments[scopedArguments.length - 1] = (
            tx: OperationsTransaction,
          ) => runWithOperationsRole(role, tx, () => callback(tx));
          return Reflect.apply(target.begin, target, scopedArguments);
        };
      }
      if (property === "unsafe") {
        return (...argumentsList: unknown[]) =>
          target.begin(async (tx) =>
            runWithOperationsRole(role, tx, async () =>
              Reflect.apply(tx.unsafe, tx, argumentsList),
            ),
          );
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

export function createOperationsDb(
  url: string,
  role: OperationsDatabaseRole,
  max: number,
): OperationsDb {
  return scopeOperationsDb(
    postgres(url, {
      prepare: false,
      max,
      idle_timeout: 20,
      connect_timeout: 10,
      connection: { options: `-c role=${role}` },
    }),
    role,
  );
}

export function operationsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.OPERATIONS_ENABLED === "true";
}

export function getOperationsDb(): OperationsDb {
  if (!operationsEnabled()) throw new Error("Operations is disabled.");
  const url = process.env.OPERATIONS_DATABASE_URL;
  if (!url) throw new Error("Operations database is not configured.");
  sharedDb ??= createOperationsDb(url, "operations_founder", 5);
  return sharedDb;
}
