import fs from "node:fs";
import path from "node:path";

import postgres from "postgres";

import { createGrowthDb, createPostgresOptions } from "@/lib/growth/db/client";
import { parseGrowthServerEnv } from "@/lib/growth/config/env";
import { resolveSiteUrl } from "@/lib/config/site-url";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const allowUnconfigured = process.argv.includes("--allow-unconfigured");

let failed = false;

function ok(message: string): void {
  console.log(`  ok    ${message}`);
}

function warn(message: string): void {
  console.log(`  warn  ${message}`);
}

function fail(message: string): void {
  console.log(`  FAIL  ${message}`);
  failed = true;
}

function localMigrationVersions(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.split("_")[0] ?? name)
    .sort();
}

async function checkConfiguration(): Promise<
  ReturnType<typeof parseGrowthServerEnv> | null
> {
  console.log("Configuration");
  try {
    const env = parseGrowthServerEnv({
      ...process.env,
      DIRECT_DATABASE_URL: undefined,
    });
    ok("Server environment is valid.");
    return env;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid configuration.";
    if (allowUnconfigured) {
      warn(`Configuration incomplete (--allow-unconfigured): ${message}`);
      return null;
    }
    fail(`Configuration invalid: ${message}`);
    return null;
  }
}

async function checkMigrations(directDatabaseUrl: string | undefined): Promise<void> {
  console.log("Migrations");
  const local = localMigrationVersions();
  console.log(`  local   ${local.length} migration file(s) in supabase/migrations`);

  if (!directDatabaseUrl) {
    if (allowUnconfigured) {
      warn("DIRECT_DATABASE_URL not set — skipping applied-migration comparison.");
    } else {
      fail("DIRECT_DATABASE_URL not set — cannot verify applied migrations.");
    }
    return;
  }

  const sql = postgres(directDatabaseUrl, createPostgresOptions());
  try {
    const rows = await sql<Array<{ version: string }>>`
      select version from supabase_migrations.schema_migrations order by version
    `;
    const applied = new Set(rows.map((row) => row.version));
    const notApplied = local.filter((version) => !applied.has(version));

    if (notApplied.length === 0) {
      ok(`All ${local.length} local migration(s) are applied.`);
    } else {
      fail(
        `${notApplied.length} local migration(s) are not applied: ${notApplied.join(", ")}`,
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.name : "Could not read applied migrations.";
    warn(`Could not compare applied migrations (${message}).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function checkTemplateChecksums(databaseUrl: string | undefined): Promise<void> {
  console.log("Email template checksums");

  if (!databaseUrl) {
    if (allowUnconfigured) {
      warn("DATABASE_URL not set — skipping template checksums.");
    } else {
      fail("DATABASE_URL not set — cannot read template checksums.");
    }
    return;
  }

  const db = createGrowthDb(databaseUrl);
  try {
    const rows = await db<
      Array<{ channel: string; templateKey: string; version: number; checksum: string }>
    >`
      select
        channel,
        template_key as "templateKey",
        version,
        md5(html_template || text_template) as checksum
      from growth.email_templates
      where status = 'published'
      order by channel, template_key
    `;

    if (rows.length === 0) {
      warn("No published templates found.");
    } else {
      for (const row of rows) {
        ok(`${row.channel}/${row.templateKey} v${row.version}  ${row.checksum}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.name : "Could not read templates.";
    warn(`Could not read template checksums (${message}).`);
  } finally {
    await db.end({ timeout: 5 });
  }
}

function checkAutomationFlag(
  env: ReturnType<typeof parseGrowthServerEnv> | null,
): void {
  console.log("Automation flag");
  if (env === null) {
    warn("Skipped — configuration was invalid.");
    return;
  }
  console.log(`  info  GROWTH_OS_AUTOMATIONS_ENABLED=${env.automationsEnabled}`);
}

function checkExpectedSiteUrl(): void {
  console.log("Expected application URL");
  console.log(`  info  resolves to ${resolveSiteUrl()}`);
}

async function main(): Promise<void> {
  const env = await checkConfiguration();
  await checkMigrations(process.env.DIRECT_DATABASE_URL);
  await checkTemplateChecksums(env?.databaseUrl ?? process.env.DATABASE_URL);
  checkAutomationFlag(env);
  checkExpectedSiteUrl();

  if (failed) {
    console.log("\nverify-growth-release: FAILED");
    process.exit(1);
  }

  console.log("\nverify-growth-release: passed");
}

main();
