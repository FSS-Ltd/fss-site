export type ScreenManifestEntry = Readonly<{
  id: string;
  role: string;
  nav: string;
  title: string;
  route?: string;
  primary: string | null;
}>;

export type ScreenCoverageStatus =
  | "planned"
  | "implemented"
  | "verified"
  | "blocked";

export type ScreenCoverageRow = Readonly<{
  screen_id: string;
  role: string;
  surface: string;
  reference: string;
  route: string;
  scenario: string;
  component: string;
  read_model: string;
  command_or_event: string;
  permission: string;
  desktop_visual: string;
  mobile_visual: string;
  functional_test: string;
  phase: string;
  status: ScreenCoverageStatus;
}>;

export type ScreenCoverageViolation = string;

const screenCoverageColumns = [
  "screen_id",
  "role",
  "surface",
  "reference",
  "route",
  "scenario",
  "component",
  "read_model",
  "command_or_event",
  "permission",
  "desktop_visual",
  "mobile_visual",
  "functional_test",
  "phase",
  "status",
] as const;

const validStatuses = new Set<ScreenCoverageStatus>([
  "planned",
  "implemented",
  "verified",
  "blocked",
]);

const requiredFields = screenCoverageColumns;
const inRepositoryReferencePrefix = "docs/design/fss-studio-experience/";

export const SCREEN_COVERAGE_CSV_HEADER = screenCoverageColumns.join(",");

export function parseCoverageCsv(input: string): ScreenCoverageRow[] {
  const lines = input.split(/\r?\n/);

  if (lines.at(-1) === "") {
    lines.pop();
  }

  if (lines.length === 0 || lines[0] !== SCREEN_COVERAGE_CSV_HEADER) {
    throw new Error("Coverage CSV must use the fixed header.");
  }

  return lines.slice(1).map((line, index) => {
    const lineNumber = index + 2;

    if (line.length === 0) {
      throw new Error(`Coverage CSV row ${lineNumber} must not be blank.`);
    }

    if (line.includes('"')) {
      throw new Error(`Coverage CSV row ${lineNumber} must not contain quoted text.`);
    }

    const values = line.split(",");

    if (values.length !== screenCoverageColumns.length) {
      throw new Error(
        `Coverage CSV row ${lineNumber} must contain ${screenCoverageColumns.length} fields.`,
      );
    }

    return createCoverageRow(values);
  });
}

export function validateScreenCoverage(
  manifest: readonly ScreenManifestEntry[],
  rows: readonly ScreenCoverageRow[],
): ScreenCoverageViolation[] {
  const violations: ScreenCoverageViolation[] = [];
  const manifestIds = new Set<string>();
  const rowCounts = new Map<string, number>();

  for (const entry of manifest) {
    const screenId = printableScreenId(entry.id);

    if (screenId === null) {
      violations.push("Manifest contains an invalid screen ID.");
      continue;
    }

    if (manifestIds.has(entry.id)) {
      violations.push(`${screenId}: duplicate manifest screen ID.`);
      continue;
    }

    manifestIds.add(entry.id);
  }

  for (const row of rows) {
    const screenId = printableScreenId(row.screen_id);

    if (screenId === null) {
      violations.push("Coverage row contains an invalid screen ID.");
      continue;
    }

    const rowCount = (rowCounts.get(row.screen_id) ?? 0) + 1;
    rowCounts.set(row.screen_id, rowCount);

    if (rowCount > 1) {
      violations.push(`${screenId}: duplicate coverage row.`);
    }

    if (!manifestIds.has(row.screen_id)) {
      violations.push(`${screenId}: unknown screen ID.`);
    }

    for (const field of requiredFields) {
      if (isBlank(row[field])) {
        violations.push(`${screenId}: ${field} is required.`);
      }
    }

    if (!row.reference.startsWith(inRepositoryReferencePrefix)) {
      violations.push(`${screenId}: reference must be an in-repository design path.`);
    }

    if (!validStatuses.has(row.status)) {
      violations.push(`${screenId}: status is invalid.`);
    }
  }

  for (const screenId of manifestIds) {
    if (!rowCounts.has(screenId)) {
      violations.push(`${screenId}: missing coverage row.`);
    }
  }

  return violations;
}

function createCoverageRow(values: readonly string[]): ScreenCoverageRow {
  const [
    screen_id,
    role,
    surface,
    reference,
    route,
    scenario,
    component,
    read_model,
    command_or_event,
    permission,
    desktop_visual,
    mobile_visual,
    functional_test,
    phase,
    status,
  ] = values;

  return {
    screen_id,
    role,
    surface,
    reference,
    route,
    scenario,
    component,
    read_model,
    command_or_event,
    permission,
    desktop_visual,
    mobile_visual,
    functional_test,
    phase,
    // CSV contents are validated by validateScreenCoverage after parsing.
    status: status as ScreenCoverageStatus,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function printableScreenId(value: string): string | null {
  return /^[A-Z][0-9]{2}$/.test(value) ? value : null;
}
