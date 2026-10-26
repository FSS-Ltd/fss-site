"use client";
import Link from "next/link";
import { useState } from "react";
import type { CrmWorkspace } from "@/lib/growth/crm/workspace-query";
import {
  formatGrowthDateTime,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import { CommandForm } from "./command-form";
import { TextField } from "./form-field";
import { fieldText } from "./form-values";
import styles from "./crm.module.css";

export function ActivityPanel({
  prospectId,
  activities,
  moreHref,
}: {
  prospectId: string;
  activities: CrmWorkspace["activities"];
  moreHref?: string;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  return (
    <section className={styles.panel} id="record-activity">
      <h2>Activity</h2>
      <p className={styles.muted}>Notes, conversations and recorded changes.</p>
      <CommandForm
        label="Log activity"
        submitLabel="Log activity"
        buildCommand={(data) => {
          const type = fieldText(data, "activityType");
          if (type !== "note" && type !== "call" && type !== "meeting")
            throw new Error("Choose an activity type.");
          return {
            kind: "add_activity",
            prospectId,
            requestId,
            activityType: type,
            body: fieldText(data, "body"),
          };
        }}
        onSuccess={(_result, form) => {
          form.reset();
          setRequestId(crypto.randomUUID());
        }}
      >
        <label className={styles.field}>
          <span>Activity type</span>
          <select name="activityType">
            <option value="note">Note</option>
            <option value="call">Call</option>
            <option value="meeting">Meeting</option>
          </select>
        </label>
        <TextField label="Activity details" name="body" maxLength={10000} />
      </CommandForm>
      {activities.rows.length === 0 ? (
        <p className={styles.empty}>No activity recorded yet.</p>
      ) : (
        <ol className={styles.items}>
          {activities.rows.map((item) => (
            <li className={styles.item} key={item.id}>
              <div className={styles.actions}>
                <span className={styles.tag}>
                  {formatGrowthStatusLabel(item.type)}
                </span>
                <time dateTime={item.createdAt}>
                  {formatGrowthDateTime(item.createdAt)}
                </time>
              </div>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
      )}
      {activities.nextCursor && moreHref && (
        <Link className={styles.linkButton} href={moreHref}>
          Older activity
        </Link>
      )}
    </section>
  );
}
