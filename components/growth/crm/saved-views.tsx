"use client";
import Link from "next/link";
import { useState } from "react";
import type { PipelineFilters } from "@/lib/growth/crm/schemas";
import type { SavedCrmView } from "@/lib/growth/crm/workspace-query";
import { pipelineHref } from "@/lib/growth/crm/pipeline-query";
import { CommandButton, CommandForm } from "./command-form";
import { FormField } from "./form-field";
import { fieldText } from "./form-values";
import styles from "./crm.module.css";
export function SavedViews({
  views,
  filters,
}: {
  views: readonly SavedCrmView[];
  filters: PipelineFilters;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  return (
    <div className={styles.saved}>
      {views.length > 0 && (
        <nav aria-label="Saved pipeline views">
          <ul className={styles.savedList}>
            {views.map((view) => (
              <li key={view.id}>
                <Link href={pipelineHref(view.filters)}>{view.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <details>
        <summary>Save or manage views</summary>
        <CommandForm
          label="Save pipeline view"
          submitLabel="Save current view"
          buildCommand={(data) => ({
            kind: "save_view",
            requestId,
            name: fieldText(data, "name"),
            filters,
          })}
          onSuccess={(_result, form) => {
            form.reset();
            setRequestId(crypto.randomUUID());
          }}
        >
          <FormField label="View name" name="name" maxLength={80} required />
        </CommandForm>
        {views.map((view) => (
          <div className={styles.item} key={`${view.id}:${view.version}`}>
            <CommandForm
              label={`Rename ${view.name}`}
              submitLabel="Rename view"
              buildCommand={(data) => ({
                kind: "rename_view",
                viewId: view.id,
                expectedVersion: view.version,
                name: fieldText(data, "name"),
              })}
            >
              <FormField
                label="Saved view name"
                name="name"
                defaultValue={view.name}
                required
                maxLength={80}
              />
            </CommandForm>
            <CommandButton
              label={`Delete ${view.name}`}
              confirm={`Delete the saved view “${view.name}”? Your records stay intact.`}
              command={{
                kind: "delete_view",
                viewId: view.id,
                expectedVersion: view.version,
              }}
            />
          </div>
        ))}
      </details>
    </div>
  );
}
