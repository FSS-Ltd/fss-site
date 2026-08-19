import { X } from "lucide-react";
import Link from "next/link";

import { formatGrowthStatusLabel } from "@/lib/growth/dashboard/formatters";
import {
  FIT_SCORE_BAND_VALUES,
  OUTREACH_STATE_VALUES,
  PROSPECT_STATUS_VALUES,
  SUPPRESSION_FILTER_VALUES,
  type ProspectFilterFacets,
  type ProspectListQuery,
} from "@/lib/growth/dashboard/prospects";

import styles from "./prospects.module.css";

const FIT_SCORE_LABELS: Record<(typeof FIT_SCORE_BAND_VALUES)[number], string> = {
  all: "All scores",
  "50": "50+",
  "70": "70+",
  "85": "85+",
};

const OUTREACH_LABELS: Record<(typeof OUTREACH_STATE_VALUES)[number], string> = {
  all: "All outreach",
  not_started: "Not started",
  active: "Active",
  paused: "Paused",
  stopped: "Stopped",
  completed: "Completed",
};

const SUPPRESSED_LABELS: Record<(typeof SUPPRESSION_FILTER_VALUES)[number], string> = {
  all: "All contacts",
  suppressed: "Suppressed only",
  contactable: "Contactable only",
};

const FILTER_LABELS: Partial<Record<keyof ProspectListQuery, string>> = {
  q: "Search",
  sector: "Sector",
  location: "Location",
  fitScoreMin: "Fit score",
  status: "Status",
  outreach: "Outreach",
  suppressed: "Suppression",
};

export function buildProspectsHref(
  query: ProspectListQuery,
  overrides: Partial<Record<keyof ProspectListQuery, string | null>> = {},
): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | null> = {
    q: query.q || null,
    sector: query.sector || null,
    location: query.location || null,
    fitScoreMin: query.fitScoreMin === "all" ? null : query.fitScoreMin,
    status: query.status === "all" ? null : query.status,
    outreach: query.outreach === "all" ? null : query.outreach,
    suppressed: query.suppressed === "all" ? null : query.suppressed,
    after: null,
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }

  const search = params.toString();
  return search ? `/growth/prospects?${search}` : "/growth/prospects";
}

function activeFilterChips(
  query: ProspectListQuery,
): { key: keyof ProspectListQuery; label: string }[] {
  const chips: { key: keyof ProspectListQuery; label: string }[] = [];

  if (query.q) chips.push({ key: "q", label: `${FILTER_LABELS.q}: "${query.q}"` });
  if (query.sector) chips.push({ key: "sector", label: `${FILTER_LABELS.sector}: ${query.sector}` });
  if (query.location)
    chips.push({ key: "location", label: `${FILTER_LABELS.location}: ${query.location}` });
  if (query.fitScoreMin !== "all")
    chips.push({
      key: "fitScoreMin",
      label: `${FILTER_LABELS.fitScoreMin}: ${FIT_SCORE_LABELS[query.fitScoreMin]}`,
    });
  if (query.status !== "all")
    chips.push({
      key: "status",
      label: `${FILTER_LABELS.status}: ${formatGrowthStatusLabel(query.status)}`,
    });
  if (query.outreach !== "all")
    chips.push({
      key: "outreach",
      label: `${FILTER_LABELS.outreach}: ${OUTREACH_LABELS[query.outreach]}`,
    });
  if (query.suppressed !== "all")
    chips.push({
      key: "suppressed",
      label: `${FILTER_LABELS.suppressed}: ${SUPPRESSED_LABELS[query.suppressed]}`,
    });

  return chips;
}

export function ProspectFilters({
  facets,
  query,
}: {
  facets: ProspectFilterFacets;
  query: ProspectListQuery;
}) {
  const chips = activeFilterChips(query);

  return (
    <div className={styles.card}>
      <form
        aria-label="Filter prospects"
        className={styles.filtersForm}
        method="GET"
      >
        <div className={styles.filtersRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="prospect-search">
              Search
            </label>
            <input
              className={styles.textInput}
              defaultValue={query.q}
              id="prospect-search"
              name="q"
              placeholder="Search prospects"
              type="search"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="prospect-sector">
              Sector
            </label>
            <select
              className={styles.select}
              defaultValue={query.sector}
              id="prospect-sector"
              name="sector"
            >
              <option value="">All sectors</option>
              {facets.sectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="prospect-location">
              Location
            </label>
            <select
              className={styles.select}
              defaultValue={query.location}
              id="prospect-location"
              name="location"
            >
              <option value="">All Kent towns</option>
              {facets.locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="prospect-fit-score">
              Fit score
            </label>
            <select
              className={styles.select}
              defaultValue={query.fitScoreMin}
              id="prospect-fit-score"
              name="fitScoreMin"
            >
              {FIT_SCORE_BAND_VALUES.map((value) => (
                <option key={value} value={value}>
                  {FIT_SCORE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="prospect-status">
              Status
            </label>
            <select
              className={styles.select}
              defaultValue={query.status}
              id="prospect-status"
              name="status"
            >
              <option value="all">All statuses</option>
              {PROSPECT_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {formatGrowthStatusLabel(value)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="prospect-outreach">
              Outreach
            </label>
            <select
              className={styles.select}
              defaultValue={query.outreach}
              id="prospect-outreach"
              name="outreach"
            >
              {OUTREACH_STATE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {OUTREACH_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="prospect-suppressed">
              Suppression
            </label>
            <select
              className={styles.select}
              defaultValue={query.suppressed}
              id="prospect-suppressed"
              name="suppressed"
            >
              {SUPPRESSION_FILTER_VALUES.map((value) => (
                <option key={value} value={value}>
                  {SUPPRESSED_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <button className={styles.applyButton} type="submit">
            Apply filters
          </button>
        </div>

        {chips.length > 0 && (
          <div className={styles.filtersFooter}>
            <ul className={styles.chipList}>
              {chips.map((chip) => (
                <li key={chip.key}>
                  <Link
                    className={styles.chip}
                    href={buildProspectsHref(query, { [chip.key]: null })}
                  >
                    {chip.label}
                    <X aria-hidden="true" size={12} strokeWidth={2.5} />
                  </Link>
                </li>
              ))}
            </ul>
            <Link className={styles.clearLink} href="/growth/prospects">
              Clear filters
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}
