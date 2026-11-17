import postgres from "postgres";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateFacebookEventUrl(value: string): void {
  const url = new URL(value);
  const username = decodeURIComponent(url.username);
  const isSupabasePooler =
    /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname);
  const sessionUser = /^growth_app\.[a-z0-9]{20}$/.test(username);
  const validUser = isSupabasePooler ? sessionUser : username === "growth_app";
  const poolingOptions = [...url.searchParams].some(
    ([key, value]) =>
      /^(pgbouncer|pool_mode)$/i.test(key) ||
      (key.toLowerCase() === "options" && /pgbouncer|pool_mode/i.test(value)),
  );
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !validUser ||
    url.port === "6543" ||
    poolingOptions ||
    (url.hostname.includes("pooler") && !isSupabasePooler) ||
    (isSupabasePooler && url.port !== "" && url.port !== "5432")
  )
    throw new Error("invalid_growth_event_url");
}
/** Each ready callback requires reauthorization and a full snapshot after LISTEN. */
export async function subscribeFacebookChanges(
  url: string | undefined,
  callbacks: { ready: () => void; change: (auditId: string) => void },
): Promise<
  | { status: "unconfigured" }
  | { status: "listening"; close: () => Promise<void> }
> {
  if (!url) return { status: "unconfigured" };
  validateFacebookEventUrl(url);
  const db = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  try {
    const [role] = await db<
      {
        name: string;
        superuser: boolean;
        createRole: boolean;
        createDb: boolean;
        bypassRls: boolean;
        privilegedMembership: boolean;
        operationsAccess: boolean;
      }[]
    >`select current_user as name,rolsuper as superuser,rolcreaterole as "createRole",rolcreatedb as "createDb",rolbypassrls as "bypassRls", exists(select 1 from pg_catalog.pg_roles member where pg_catalog.pg_has_role(current_user,member.oid,'member') and (member.rolsuper or member.rolcreaterole or member.rolcreatedb or member.rolbypassrls)) as "privilegedMembership", pg_catalog.has_schema_privilege(current_user,'operations','usage') as "operationsAccess" from pg_catalog.pg_roles where rolname=current_user`;
    if (
      !role ||
      role.name !== "growth_app" ||
      role.superuser ||
      role.createRole ||
      role.createDb ||
      role.bypassRls ||
      role.privilegedMembership ||
      role.operationsAccess
    )
      throw new Error("invalid_growth_event_role");
    let closed = false;
    const listener = await db.listen(
      "growth_audit_changed",
      (payload) => {
        if (!closed && UUID.test(payload)) callbacks.change(payload);
      },
      () => {
        if (!closed) callbacks.ready();
      },
    );
    return {
      status: "listening",
      close: async () => {
        if (closed) return;
        closed = true;
        try {
          await listener.unlisten();
        } finally {
          await db.end({ timeout: 5 });
        }
      },
    };
  } catch (error) {
    await db.end({ timeout: 5 });
    throw error;
  }
}

export function readFacebookEventUrl(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (env.NEXT_PUBLIC_GROWTH_EVENT_DATABASE_URL !== undefined)
    throw new Error("public_growth_event_url_forbidden");
  const value = env.GROWTH_EVENT_DATABASE_URL;
  if (!value) return undefined;
  validateFacebookEventUrl(value);
  return value;
}
