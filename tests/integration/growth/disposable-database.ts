import postgres from "postgres";
import { randomUUID } from "node:crypto";

export function assertDisposableGrowthDatabase(value: string): URL {
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== "127.0.0.1" ||
    !["5432", "55487", "55488", "55489", "55491"].includes(url.port) ||
    url.pathname !== "/fss_growth_test"
  )
    throw new Error("A disposable local fss_growth_test database is required.");
  return url;
}

export async function withGrowthLogin(
  connection: string,
  elevated: boolean,
  operation: (url: string) => Promise<void>,
): Promise<void> {
  const url = assertDisposableGrowthDatabase(connection);
  const admin = postgres(connection, { max: 1 });
  try {
    const [original] = await admin<
      { password: string | null; login: boolean; createRole: boolean }[]
    >`select rolpassword as password, rolcanlogin as login, rolcreaterole as "createRole" from pg_authid where rolname='growth_app'`;
    if (!original) throw new Error("growth_app role is missing");
    const password = randomUUID();
    const [statement] = await admin<
      { sql: string }[]
    >`select format('alter role growth_app login password %L', ${password}::text) as sql`;
    try {
      await admin.unsafe(statement!.sql);
      if (elevated) await admin`alter role growth_app createrole`;
      url.username = "growth_app";
      url.password = password;
      await operation(url.toString());
    } finally {
      const [restore] = await admin<
        { sql: string }[]
      >`select format('alter role growth_app %s %s password %L', ${original.login ? "login" : "nologin"}::text, ${original.createRole ? "createrole" : "nocreaterole"}::text, ${original.password}::text) as sql`;
      await admin.unsafe(restore!.sql);
    }
  } finally {
    await admin.end();
  }
}
