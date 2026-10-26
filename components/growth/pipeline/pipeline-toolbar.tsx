import Link from "next/link";
import type { PipelineFilters } from "@/lib/growth/crm/schemas";
import { pipelineHref } from "@/lib/growth/crm/pipeline-query";
import styles from "./workspace.module.css";
import baseStyles from "./pipeline.module.css";

export function PipelineToolbar({ filters }: { filters: PipelineFilters }) {
  return (
    <div className={styles.toolbar}>
      <nav aria-label="Pipeline views" className={styles.viewLinks}>
        <Link
          href={pipelineHref({
            ...filters,
            q: "",
            sector: "",
            location: "",
            stage: "all",
            nextAction: "all",
          })}
          aria-current={filters.nextAction === "all" ? "page" : undefined}
        >
          Open opportunities
        </Link>
        <Link
          href={pipelineHref(filters, { nextAction: "overdue" })}
          aria-current={filters.nextAction === "overdue" ? "page" : undefined}
        >
          Overdue follow-ups
        </Link>
        <Link
          href={pipelineHref(filters, { nextAction: "missing" })}
          aria-current={filters.nextAction === "missing" ? "page" : undefined}
        >
          Missing next step
        </Link>
      </nav>
      <form
        aria-label="Filter pipeline"
        className={styles.filterForm}
        method="GET"
      >
        <input type="hidden" name="view" value={filters.view} />
        <label>
          Search
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            maxLength={120}
            placeholder="Company, contact or deal"
          />
        </label>
        <label>
          Stage
          <select name="stage" defaultValue={filters.stage}>
            <option value="all">All open stages</option>
            <option value="new">New</option>
            <option value="qualified">Qualified</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
          </select>
        </label>
        <label>
          Sector
          <input
            name="sector"
            defaultValue={filters.sector}
            maxLength={120}
            placeholder="Any sector"
          />
        </label>
        <label>
          Town
          <input
            name="location"
            defaultValue={filters.location}
            maxLength={120}
            placeholder="Any Kent town"
          />
        </label>
        <label>
          Next step
          <select name="nextAction" defaultValue={filters.nextAction}>
            <option value="all">Any next step</option>
            <option value="overdue">Overdue</option>
            <option value="upcoming">Upcoming</option>
            <option value="missing">Missing</option>
          </select>
        </label>
        <button type="submit" className={baseStyles.moveButton}>
          Apply filters
        </button>
      </form>
      <div className={styles.toolbarFooter}>
        <Link
          href={pipelineHref({
            ...filters,
            q: "",
            sector: "",
            location: "",
            stage: "all",
            nextAction: "all",
          })}
        >
          Clear filters
        </Link>
        <nav aria-label="Pipeline layout">
          <Link
            aria-current={filters.view === "board" ? "page" : undefined}
            href={pipelineHref(filters, { view: "board" })}
          >
            Board
          </Link>
          <Link
            aria-current={filters.view === "list" ? "page" : undefined}
            href={pipelineHref(filters, { view: "list" })}
          >
            List
          </Link>
        </nav>
      </div>
    </div>
  );
}
