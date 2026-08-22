import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type MigrationFile = { filename: string; content: string };

export type MigrationPolicyViolationRule =
  | "duplicate_timestamp"
  | "non_sql_file"
  | "destructive_statement"
  | "missing_schema_qualification"
  | "browser_role_grant";

export type MigrationPolicyViolation = {
  filename: string;
  rule: MigrationPolicyViolationRule;
  detail: string;
};

const DESTRUCTIVE_STATEMENT_PATTERN =
  /\b(drop\s+table|drop\s+schema|drop\s+database|truncate)\b/i;

const UNQUALIFIED_CREATE_TABLE_PATTERN =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s*\(/gi;

const BROWSER_FACING_ROLES = ["anon", "authenticated"];

function timestampOf(filename: string): string {
  return filename.split("_")[0] ?? filename;
}

function checkNonSqlFile(file: MigrationFile): MigrationPolicyViolation[] {
  if (file.filename.endsWith(".sql")) return [];
  return [
    {
      filename: file.filename,
      rule: "non_sql_file",
      detail: "Migrations directory must contain only .sql files.",
    },
  ];
}

function checkDestructiveStatements(
  file: MigrationFile,
): MigrationPolicyViolation[] {
  const match = DESTRUCTIVE_STATEMENT_PATTERN.exec(file.content);
  if (!match) return [];
  return [
    {
      filename: file.filename,
      rule: "destructive_statement",
      detail: `Disallowed destructive statement: "${match[0]}".`,
    },
  ];
}

function checkSchemaQualification(
  file: MigrationFile,
): MigrationPolicyViolation[] {
  const violations: MigrationPolicyViolation[] = [];
  for (const match of file.content.matchAll(UNQUALIFIED_CREATE_TABLE_PATTERN)) {
    const tableName = match[1] ?? "";
    violations.push({
      filename: file.filename,
      rule: "missing_schema_qualification",
      detail: `Table "${tableName}" must be created as "growth.${tableName}", not in the default schema.`,
    });
  }
  return violations;
}

function checkBrowserRoleGrants(
  file: MigrationFile,
): MigrationPolicyViolation[] {
  const violations: MigrationPolicyViolation[] = [];
  for (const rawLine of file.content.split(/;|\n/)) {
    const statement = rawLine.trim();
    if (!/^grant\b/i.test(statement)) continue;
    const toClause = /\bto\s+(.+)$/i.exec(statement)?.[1] ?? "";
    for (const role of BROWSER_FACING_ROLES) {
      if (new RegExp(`\\b${role}\\b`, "i").test(toClause)) {
        violations.push({
          filename: file.filename,
          rule: "browser_role_grant",
          detail: `Statement grants Growth OS access directly to browser-facing role "${role}": "${statement}".`,
        });
      }
    }
  }
  return violations;
}

function checkDuplicateTimestamps(
  files: readonly MigrationFile[],
): MigrationPolicyViolation[] {
  const byTimestamp = new Map<string, MigrationFile[]>();
  for (const file of files) {
    const timestamp = timestampOf(file.filename);
    const bucket = byTimestamp.get(timestamp) ?? [];
    bucket.push(file);
    byTimestamp.set(timestamp, bucket);
  }

  const violations: MigrationPolicyViolation[] = [];
  for (const [timestamp, bucket] of byTimestamp) {
    if (bucket.length < 2) continue;
    for (const file of bucket) {
      violations.push({
        filename: file.filename,
        rule: "duplicate_timestamp",
        detail: `Migration timestamp "${timestamp}" is shared by ${bucket.length} files.`,
      });
    }
  }
  return violations;
}

export function checkMigrationPolicy(
  files: readonly MigrationFile[],
): MigrationPolicyViolation[] {
  const violations: MigrationPolicyViolation[] = [
    ...checkDuplicateTimestamps(files),
  ];

  for (const file of files) {
    violations.push(...checkNonSqlFile(file));
    if (!file.filename.endsWith(".sql")) continue;
    violations.push(
      ...checkDestructiveStatements(file),
      ...checkSchemaQualification(file),
      ...checkBrowserRoleGrants(file),
    );
  }

  return violations;
}

function readMigrationFiles(migrationsDir: string): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .sort()
    .map((filename) => ({
      filename,
      content: fs.readFileSync(path.join(migrationsDir, filename), "utf8"),
    }));
}

function main(): void {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const files = readMigrationFiles(migrationsDir);
  const violations = checkMigrationPolicy(files);

  if (violations.length === 0) {
    console.log(`verify-migrations: ${files.length} migration(s) passed policy.`);
    return;
  }

  for (const violation of violations) {
    console.log(`  FAIL  ${violation.filename}  [${violation.rule}]  ${violation.detail}`);
  }
  console.log(`\nverify-migrations: ${violations.length} violation(s) found.`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
