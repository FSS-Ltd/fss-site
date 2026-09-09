"use client";
import { useState } from "react";
import type { MetricFilters } from "@/lib/operations/metrics/filters";
export function ExportControl({
  filters,
}: {
  filters: MetricFilters;
}): React.JSX.Element {
  const [state, setState] = useState<
    "idle" | "pending" | "queued" | "complete" | "error"
  >("idle");
  const [id, setId] = useState<string | null>(null);
  async function request(): Promise<void> {
    setState("pending");
    try {
      const response = await fetch("/api/growth/operations/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", filters }),
      });
      const body: unknown = await response.json();
      if (
        !response.ok ||
        typeof body !== "object" ||
        body === null ||
        !("id" in body) ||
        typeof body.id !== "string"
      )
        throw new Error();
      setId(body.id);
      setState("queued");
    } catch {
      setState("error");
    }
  }
  async function check(): Promise<void> {
    if (!id) return;
    setState("pending");
    try {
      const response = await fetch(
        `/api/growth/operations/exports?id=${encodeURIComponent(id)}`,
      );
      const body: unknown = await response.json();
      if (
        !response.ok ||
        typeof body !== "object" ||
        body === null ||
        !("state" in body)
      )
        throw new Error();
      setState(
        body.state === "complete"
          ? "complete"
          : body.state === "failed"
            ? "error"
            : "queued",
      );
    } catch {
      setState("error");
    }
  }
  return (
    <section>
      <h2>Export receivables</h2>
      <p>
        Founder-only CSV, processed as a background job. Maximum 10,000 matching
        invoices; larger reports require narrower filters.
      </p>
      <button
        onClick={request}
        disabled={state === "pending" || state === "queued"}
      >
        {state === "pending" ? "Preparing…" : "Request export"}
      </button>
      {state === "queued" ? (
        <>
          <p role="status">Queued for the Operations export worker.</p>
          <button onClick={check}>Check export</button>
        </>
      ) : null}
      {state === "complete" && id ? (
        <a
          href={`/api/growth/operations/exports?id=${encodeURIComponent(id)}&download=1`}
        >
          Download CSV
        </a>
      ) : null}
      {state === "error" ? (
        <p role="alert">
          Export could not complete. Narrow the filters or check the export
          worker, then retry.
        </p>
      ) : null}
    </section>
  );
}
