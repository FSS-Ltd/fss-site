# FSS Growth OS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the private PostgreSQL foundation, typed runtime connection, founder-only Google sign-in, audit trail, and local integration-test harness used by every later Growth OS plan.

**Architecture:** Supabase supplies a private `growth` PostgreSQL schema. Vercel server code connects through the transaction pooler with a least-privileged role. Auth.js handles Google OIDC for the dashboard, while a repeated server-side allowlist check protects every Growth OS read and mutation.

**Tech Stack:** Next.js 16 App Router, Auth.js, `postgres`, Zod 4, Supabase CLI, PostgreSQL, Node test runner, pnpm.

## Global Constraints

- Apply every constraint in `2026-08-16-fss-growth-os-00-master.md`.
- The dashboard allowlist contains exactly `j.ntagengwa@faithfulsoftware.dev` through `GROWTH_OS_OWNER_EMAIL`.
- Do not expose a Supabase key, database URL, or token to the browser.
- Create migrations with `supabase migration new`. Do not invent migration timestamps.
- Keep runtime and migration credentials separate.
- Do not deploy or apply remote migrations during this plan without explicit approval.

---

### Task 1: Add Foundation Dependencies, Scripts, And Environment Contract

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `.env.example`
- Create: `lib/growth/config/env.ts`
- Create: `lib/growth/config/env.test.ts`

**Interfaces:**

- Consumes: existing Next.js environment and Zod dependency
- Produces: `GrowthServerEnv`, `readGrowthServerEnv`, standard Growth OS test scripts

- [ ] **Step 1: Write failing environment tests**

Create `lib/growth/config/env.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { parseGrowthServerEnv } from "./env";

const validEnv = {
  DATABASE_URL: "postgresql://app:secret@example.test:6543/postgres",
  DIRECT_DATABASE_URL: "postgresql://admin:secret@example.test:5432/postgres",
  AUTH_SECRET: "a".repeat(32),
  GOOGLE_AUTH_CLIENT_ID: "client-id",
  GOOGLE_AUTH_CLIENT_SECRET: "client-secret",
  GROWTH_OS_OWNER_EMAIL: "j.ntagengwa@faithfulsoftware.dev",
  TOKEN_ENCRYPTION_KEY: "b".repeat(32),
  GROWTH_OS_AUTOMATIONS_ENABLED: "false",
};

test("accepts the complete server environment", () => {
  const result = parseGrowthServerEnv(validEnv);
  assert.equal(result.ownerEmail, "j.ntagengwa@faithfulsoftware.dev");
  assert.equal(result.automationsEnabled, false);
});

test("rejects a public database credential", () => {
  assert.throws(
    () =>
      parseGrowthServerEnv({
        ...validEnv,
        NEXT_PUBLIC_DATABASE_URL: validEnv.DATABASE_URL,
      }),
    /NEXT_PUBLIC_DATABASE_URL/,
  );
});

test("rejects the wrong founder address", () => {
  assert.throws(
    () =>
      parseGrowthServerEnv({
        ...validEnv,
        GROWTH_OS_OWNER_EMAIL: "someone@example.com",
      }),
    /GROWTH_OS_OWNER_EMAIL/,
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --import tsx --test lib/growth/config/env.test.ts
```

Expected: FAIL because `lib/growth/config/env.ts` does not exist.

- [ ] **Step 3: Install the required packages**

Run:

```bash
pnpm add postgres next-auth
```

Do not add the Supabase JavaScript client.

- [ ] **Step 4: Add the test scripts**

Add to `package.json`:

```json
{
  "test:unit": "node --import tsx --test 'lib/**/*.test.ts' 'components/**/*.test.ts'",
  "test:integration:growth": "node --import tsx --test 'tests/integration/growth/**/*.test.ts'",
  "test:growth": "pnpm test:unit && pnpm test:integration:growth"
}
```

- [ ] **Step 5: Implement typed environment parsing**

Create `lib/growth/config/env.ts` with one Zod schema. Export:

```ts
export type GrowthServerEnv = {
  databaseUrl: string;
  directDatabaseUrl: string;
  authSecret: string;
  googleAuthClientId: string;
  googleAuthClientSecret: string;
  ownerEmail: "j.ntagengwa@faithfulsoftware.dev";
  tokenEncryptionKey: string;
  automationsEnabled: boolean;
};

export function parseGrowthServerEnv(
  source: Record<string, string | undefined>,
): GrowthServerEnv;

export function readGrowthServerEnv(): GrowthServerEnv;
```

Reject `NEXT_PUBLIC_DATABASE_URL`, `NEXT_PUBLIC_DIRECT_DATABASE_URL`, and `NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY` if present. Trim and lowercase the owner email before comparing it to the exact founder address.

- [ ] **Step 6: Create the safe environment template**

Create `.env.example` with empty values only:

```dotenv
DATABASE_URL=
DIRECT_DATABASE_URL=
AUTH_SECRET=
GOOGLE_AUTH_CLIENT_ID=
GOOGLE_AUTH_CLIENT_SECRET=
GROWTH_OS_OWNER_EMAIL=j.ntagengwa@faithfulsoftware.dev
TOKEN_ENCRYPTION_KEY=
GROWTH_OS_AUTOMATIONS_ENABLED=false
```

- [ ] **Step 7: Run the test and verify GREEN**

Run:

```bash
node --import tsx --test lib/growth/config/env.test.ts
```

Expected: three tests pass.

- [ ] **Step 8: Commit**

```bash
git add -- package.json pnpm-lock.yaml .env.example lib/growth/config/env.ts lib/growth/config/env.test.ts
git commit -m "feat: add Growth OS foundation configuration"
```

### Task 2: Initialise And Link Supabase Safely

**Files:**

- Create: `supabase/config.toml`
- Create through CLI: `supabase/migrations/*_growth_foundation.sql`

**Interfaces:**

- Consumes: Supabase project `gfeyanrriryihpcgdvqi`
- Produces: reproducible local Supabase project and first migration

- [ ] **Step 1: Discover the installed CLI**

Run:

```bash
supabase --version
supabase --help
supabase migration new --help
```

Expected: a current Supabase CLI and documented migration command.

- [ ] **Step 2: Authenticate the operator session**

Run interactively:

```bash
supabase login
```

Do not store the access token in the repository.

- [ ] **Step 3: Initialise the repository**

Run only if `supabase/config.toml` does not already exist:

```bash
supabase init
```

- [ ] **Step 4: Link the existing project**

Run:

```bash
supabase link --project-ref gfeyanrriryihpcgdvqi
```

Do not apply a migration yet.

- [ ] **Step 5: Generate the migration filename**

Run:

```bash
supabase migration new growth_foundation
```

Use the exact path printed by the CLI for the next task. The timestamp portion is intentionally CLI-generated.

### Task 3: Create The Private Foundation Schema

**Files:**

- Modify: `supabase/migrations/*_growth_foundation.sql`
- Create: `tests/integration/growth/schema-foundation.test.ts`

**Interfaces:**

- Consumes: the CLI-generated migration file
- Produces: `growth.businesses`, `growth.contacts`, `growth.prospects`, `growth.integration_connections`, `growth.audit_log`, and runtime role grants

- [ ] **Step 1: Write the failing schema integration test**

Create `tests/integration/growth/schema-foundation.test.ts` using `postgres` and `DIRECT_DATABASE_URL`. Assert:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";

const connectionString = process.env.DIRECT_DATABASE_URL;

test(
  "foundation schema is private and complete",
  { skip: !connectionString },
  async () => {
    const sql = postgres(connectionString!, { max: 1 });
    try {
      const tables = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'growth'
      order by table_name
    `;
      assert.deepEqual(
        tables.map((row) => row.table_name),
        [
          "audit_log",
          "businesses",
          "contacts",
          "integration_connections",
          "prospects",
        ],
      );

      const exposed = await sql<{ has_usage: boolean }[]>`
      select has_schema_privilege('anon', 'growth', 'usage') as has_usage
    `;
      assert.equal(exposed[0]?.has_usage, false);
    } finally {
      await sql.end();
    }
  },
);
```

- [ ] **Step 2: Run the test and verify RED**

Run after `supabase start` and exporting the local direct URL:

```bash
node --import tsx --test tests/integration/growth/schema-foundation.test.ts
```

Expected: FAIL because the tables do not exist.

- [ ] **Step 3: Write the migration**

The migration must:

```sql
create extension if not exists pgcrypto;
create schema if not exists growth;

revoke all on schema growth from public;
revoke all on schema growth from anon;
revoke all on schema growth from authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'growth_app') then
    create role growth_app nologin;
  end if;
end
$$;

grant usage on schema growth to growth_app;
```

Create enums for `corporate_type`, `corporate_status`, `subscriber_type`, `lawful_basis`, `prospect_status`, `integration_provider`, and `connection_status` using the values in `docs/growth-os/data-api-security.md`.

Create the five tables with these non-negotiable checks:

```sql
create table growth.businesses (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trading_name text,
  company_number text,
  corporate_type growth.corporate_type not null,
  corporate_status growth.corporate_status not null,
  sector text not null,
  locality text not null,
  county text not null check (county = 'Kent'),
  website_url text,
  google_place_id text,
  google_maps_reference_url text,
  first_party_source_url text,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_number),
  unique (google_place_id)
);

create table growth.contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references growth.businesses(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  role_title text,
  email text not null,
  normalised_email text generated always as (lower(trim(email))) stored,
  email_source_url text not null,
  email_verified_at timestamptz not null,
  subscriber_type growth.subscriber_type not null,
  lawful_basis growth.lawful_basis not null,
  privacy_notice_version text,
  privacy_notice_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalised_email)
);

create table growth.prospects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references growth.businesses(id) on delete restrict,
  primary_contact_id uuid references growth.contacts(id) on delete restrict,
  research_run_id uuid,
  status growth.prospect_status not null default 'new',
  fit_score smallint not null check (fit_score between 0 and 100),
  opportunity_summary text not null,
  recommended_offer text not null,
  estimated_one_off_min_pence integer not null check (estimated_one_off_min_pence >= 0),
  estimated_one_off_max_pence integer not null check (estimated_one_off_max_pence >= estimated_one_off_min_pence),
  estimated_monthly_pence integer not null default 0 check (estimated_monthly_pence >= 0),
  next_action text,
  next_action_due_at timestamptz,
  assigned_owner_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_open_prospect_per_business
on growth.prospects (business_id)
where status not in ('won', 'lost', 'rejected', 'suppressed');
```

Create `integration_connections` and `audit_log` exactly from the data contract. `audit_log` receives no update or delete grants. Add all indexes named in the contract.

Grant only `select`, `insert`, and `update` on operational tables to `growth_app`. Grant `select` and `insert` only on `audit_log`.

- [ ] **Step 4: Reset the local database**

```bash
supabase db reset
```

Expected: migration applies without error.

- [ ] **Step 5: Run the schema test and verify GREEN**

```bash
node --import tsx --test tests/integration/growth/schema-foundation.test.ts
```

Expected: schema and privilege assertions pass.

- [ ] **Step 6: Run database advisors if the installed CLI supports them**

First run:

```bash
supabase db advisors --help
```

If available, run the local advisor command documented by the CLI and fix security or performance findings caused by this migration. If unavailable, record the installed CLI version in the pull request and use the Supabase dashboard advisor before the remote migration gate.

- [ ] **Step 7: Commit**

```bash
git add -- supabase/config.toml supabase/migrations tests/integration/growth/schema-foundation.test.ts
git commit -m "feat: add private Growth OS database foundation"
```

### Task 4: Add The Lazy PostgreSQL Client And Transaction Boundary

**Files:**

- Create: `lib/growth/db/client.ts`
- Create: `lib/growth/db/client.test.ts`
- Create: `lib/growth/db/types.ts`

**Interfaces:**

- Consumes: `GrowthServerEnv.databaseUrl`
- Produces: `GrowthDb`, `createGrowthDb`, `getGrowthDb`, `withGrowthTransaction`

- [ ] **Step 1: Write failing client tests**

Test that runtime configuration uses `prepare: false`, that construction is lazy, and that `withGrowthTransaction` commits on success and rolls back on error. Inject a fake SQL factory instead of connecting to a database.

The exported configuration helper must satisfy:

```ts
assert.deepEqual(createPostgresOptions(), {
  prepare: false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --import tsx --test lib/growth/db/client.test.ts
```

- [ ] **Step 3: Implement the client**

Export:

```ts
import type { Sql } from "postgres";

export type GrowthDb = Sql<Record<string, never>>;

export function createPostgresOptions() {
  return {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  } as const;
}

export function createGrowthDb(connectionString: string): GrowthDb;
export function getGrowthDb(): GrowthDb;

export async function withGrowthTransaction<T>(
  db: GrowthDb,
  operation: (tx: GrowthDb) => Promise<T>,
): Promise<T>;
```

Do not create a connection while `next build` imports unrelated modules. Initialise on the first call to `getGrowthDb` and reuse the client within the server process.

- [ ] **Step 4: Run the test and verify GREEN**

```bash
node --import tsx --test lib/growth/db/client.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -- lib/growth/db
git commit -m "feat: add Growth OS database client"
```

### Task 5: Add Typed Foundation Repositories And Audit Service

**Files:**

- Create: `lib/growth/db/repositories/businesses.ts`
- Create: `lib/growth/db/repositories/contacts.ts`
- Create: `lib/growth/db/repositories/prospects.ts`
- Create: `lib/growth/audit/service.ts`
- Create: `lib/growth/audit/service.test.ts`

**Interfaces:**

- Consumes: `GrowthDb`
- Produces: repository input/output types and `appendAuditEvent`

- [ ] **Step 1: Write a failing audit test**

Use a recording fake DB and assert the service writes only allowlisted scalar metadata:

```ts
await appendAuditEvent(fakeDb, {
  correlationId: "corr-1",
  actorType: "founder",
  actorId: "founder-email-hash",
  action: "prospect.reviewed",
  entityType: "prospect",
  entityId: "00000000-0000-0000-0000-000000000001",
  metadata: { fitScore: 91, approved: true },
});
```

Add a rejection test for nested objects, tokens, body copy, and keys matching `/token|secret|password|body|html/i`.

- [ ] **Step 2: Run the test and verify RED**

```bash
node --import tsx --test lib/growth/audit/service.test.ts
```

- [ ] **Step 3: Implement focused repositories**

Each repository exports explicit input types and parameterised queries. Do not return `select *`. Example:

```ts
export type ProspectSummary = {
  id: string;
  businessName: string;
  contactName: string | null;
  status: ProspectStatus;
  fitScore: number;
  nextAction: string | null;
  nextActionDueAt: Date | null;
};

export async function findProspectSummaryById(
  db: GrowthDb,
  prospectId: string,
): Promise<ProspectSummary | null>;
```

No repository can select `encrypted_refresh_token` except the dedicated provider connection service introduced later.

- [ ] **Step 4: Implement and test `appendAuditEvent`**

Use the `AuditInput` signature in the master plan. Throw before the query when metadata contains a forbidden key or non-scalar value.

- [ ] **Step 5: Run unit tests**

```bash
node --import tsx --test lib/growth/audit/service.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -- lib/growth/db/repositories lib/growth/audit
git commit -m "feat: add Growth OS repositories and audit service"
```

### Task 6: Add Founder-Only Google Authentication

**Files:**

- Create: `auth.ts`
- Create: `proxy.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/(growth)/growth/login/page.tsx`
- Create: `lib/growth/auth/policy.ts`
- Create: `lib/growth/auth/policy.test.ts`
- Create: `lib/growth/auth/require-founder.ts`

**Interfaces:**

- Consumes: Google OIDC credentials and `GROWTH_OS_OWNER_EMAIL`
- Produces: `auth`, `handlers`, `requireFounder`, `isAllowedFounderProfile`

- [ ] **Step 1: Write failing policy tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedFounderProfile } from "./policy";

test("accepts only the verified founder email", () => {
  assert.equal(
    isAllowedFounderProfile(
      { email: "J.Ntagengwa@faithfulsoftware.dev", emailVerified: true },
      "j.ntagengwa@faithfulsoftware.dev",
    ),
    true,
  );
});

test("rejects another verified Workspace account", () => {
  assert.equal(
    isAllowedFounderProfile(
      { email: "colleague@faithfulsoftware.dev", emailVerified: true },
      "j.ntagengwa@faithfulsoftware.dev",
    ),
    false,
  );
});

test("rejects an unverified matching address", () => {
  assert.equal(
    isAllowedFounderProfile(
      { email: "j.ntagengwa@faithfulsoftware.dev", emailVerified: false },
      "j.ntagengwa@faithfulsoftware.dev",
    ),
    false,
  );
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --import tsx --test lib/growth/auth/policy.test.ts
```

- [ ] **Step 3: Implement the pure allowlist policy**

The function trims and lowercases both addresses. It requires `emailVerified === true` and exact equality. The Google `hd` hint improves account selection but is not an authorization decision.

- [ ] **Step 4: Configure Auth.js**

In `auth.ts`, configure the Google provider with OpenID, email, and profile only. Export:

```ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google(/* server credentials */)],
  callbacks: {
    async signIn({ profile }) {
      return isAllowedFounderProfile(
        {
          email: profile?.email,
          emailVerified: profile?.email_verified === true,
        },
        readGrowthServerEnv().ownerEmail,
      );
    },
  },
});
```

Use secure, HTTP-only, same-site cookies. Do not request Gmail scopes from this OAuth client.

- [ ] **Step 5: Add the Auth.js route**

`app/api/auth/[...nextauth]/route.ts` exports `GET` and `POST` from `handlers`.

- [ ] **Step 6: Protect `/growth` in `proxy.ts`**

Allow `/growth/login` and the Auth.js callback routes. Redirect unauthenticated dashboard requests to `/growth/login`. `proxy.ts` is only the first gate; it does not replace `requireFounder`.

- [ ] **Step 7: Implement `requireFounder`**

```ts
export type FounderSession = {
  email: string;
  actorId: string;
};

export async function requireFounder(): Promise<FounderSession>;
```

Call `auth()`, repeat the exact allowlist policy, and throw a typed `FounderAuthorizationError` on failure. Derive `actorId` as a stable one-way hash of the normalised founder email so audit rows do not need the raw address.

- [ ] **Step 8: Build the accessible login page**

The page contains the FSS mark, `Founder workspace`, a single `Continue with Google` button, and a clear unauthorized/error state. It does not offer email/password or account registration.

- [ ] **Step 9: Run tests and build**

```bash
node --import tsx --test lib/growth/auth/policy.test.ts
pnpm lint
pnpm build
```

- [ ] **Step 10: Commit**

```bash
git add -- auth.ts proxy.ts app/api/auth 'app/(growth)/growth/login' lib/growth/auth
git commit -m "feat: restrict Growth OS to the founder account"
```

### Task 7: Add Foundation Integration Verification

**Files:**

- Create: `tests/integration/growth/foundation-repositories.test.ts`
- Create: `docs/growth-os/runbooks/local-setup.md`

**Interfaces:**

- Consumes: foundation migration, database client, repositories
- Produces: repeatable local setup and integration proof

- [ ] **Step 1: Write the repository integration test**

The test inserts a Kent limited company, a verified corporate contact, and a prospect in one transaction. It then reads the typed summary and asserts duplicate company number, duplicate email, non-Kent county, and fit score 101 all fail.

- [ ] **Step 2: Write the local setup runbook**

Include these exact commands and explain which are interactive:

```bash
pnpm install --frozen-lockfile
supabase --version
supabase login
supabase init
supabase link --project-ref gfeyanrriryihpcgdvqi
supabase start
supabase db reset
pnpm test:growth
pnpm lint
pnpm build
```

The runbook must say not to commit `.env.local`, Supabase tokens, database passwords, or `.vercel/`.

- [ ] **Step 3: Run all foundation checks**

```bash
supabase db reset
supabase migration list --local
pnpm test:growth
pnpm test:redesign
pnpm lint
pnpm build
```

Expected: every command exits 0.

- [ ] **Step 4: Review the diff**

Inspect every changed file for secret leakage, browser-visible credentials, invalid imports, TypeScript errors, migration grants, and unrelated edits.

- [ ] **Step 5: Commit**

```bash
git add -- tests/integration/growth/foundation-repositories.test.ts docs/growth-os/runbooks/local-setup.md
git commit -m "test: verify Growth OS foundation locally"
```
