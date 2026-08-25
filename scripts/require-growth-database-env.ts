import { pathToFileURL } from "node:url";

export function requireGrowthDatabaseUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      "DIRECT_DATABASE_URL is required for Growth OS database integration tests.",
    );
  }

  let protocol: string;
  try {
    protocol = new URL(value).protocol;
  } catch {
    throw new Error(
      "DIRECT_DATABASE_URL must be a valid PostgreSQL URL for Growth OS database integration tests.",
    );
  }
  if (protocol !== "postgres:" && protocol !== "postgresql:") {
    throw new Error(
      "DIRECT_DATABASE_URL must use postgres or postgresql for Growth OS database integration tests.",
    );
  }

  return value;
}

function main(): void {
  requireGrowthDatabaseUrl(process.env.DIRECT_DATABASE_URL);
  console.log("Growth OS database integration environment is configured.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
