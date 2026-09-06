import { pathToFileURL } from "node:url";

export function requireOperationsTestDatabaseUrl(
  value: string | undefined,
): string {
  const message =
    "OPERATIONS_TEST_DATABASE_URL must target the local fss_operations_test or fss_growth_test PostgreSQL database without URL parameters.";
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error(message);
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !["/fss_operations_test", "/fss_growth_test"].includes(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new Error(message);
  }
  return url.href;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  requireOperationsTestDatabaseUrl(process.env.OPERATIONS_TEST_DATABASE_URL);
  console.log("Operations local integration database is configured.");
}
