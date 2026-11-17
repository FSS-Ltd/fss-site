"use client";
import { CommandForm, Field, optional, timestamp, value } from "./command-form";
import type { Destination } from "./types";

type Props = { destination: Destination; saved: (id: string) => void };
export function DestinationCapture({ saved }: { saved: (id: string) => void }) {
  return (
    <CommandForm
      label="Save destination"
      onSuccess={saved}
      build={(d) => ({
        type: "capture_destination",
        destination: {
          name: value(d, "name"),
          url: value(d, "url"),
          kind: value(d, "kind"),
          locality: optional(d, "locality"),
          websiteUrl: optional(d, "website"),
          observation: {
            sourceUrl: value(d, "source"),
            summary: value(d, "summary"),
            observedAt: timestamp(d, "observed"),
          },
        },
      })}
    >
      <Field label="Business or destination name" name="name" required />
      <Field label="Public Facebook URL" name="url" type="url" required />
      <Field label="Type" name="kind">
        <select name="kind">
          <option value="page">Page</option>
          <option value="group">Group</option>
        </select>
      </Field>
      <Field label="Locality (if known)" name="locality" />
      <Field label="Website URL (if known)" name="website" type="url" />
      <Field label="Observation source URL" name="source" type="url" required />
      <Field label="Public observation" name="summary" required />
      <Field
        label="Observed at"
        name="observed"
        type="datetime-local"
        required
      />
    </CommandForm>
  );
}
export function RulesForm({ destination, saved }: Props) {
  const version = destination.version;
  return (
    <CommandForm
      label="Save rules review"
      onSuccess={saved}
      build={(d) => ({
        type: "review_rules",
        destinationId: destination.id,
        expectedVersion: version,
        sourceUrl: value(d, "source"),
        summary: value(d, "summary"),
        observedAt: timestamp(d, "observed"),
        expiresAt: timestamp(d, "expires"),
        decision: value(d, "decision"),
      })}
    >
      <p>
        Reviewing version {version}. Rules can be reviewed for up to 30 days.
      </p>
      <Field label="Rules source URL" name="source" type="url" required />
      <Field label="Observed rules" name="summary" required />
      <Field
        label="Observed at"
        name="observed"
        type="datetime-local"
        required
      />
      <Field
        label="Review expires at"
        name="expires"
        type="datetime-local"
        required
      />
      <Field label="Decision" name="decision">
        <select name="decision">
          <option value="unknown">Unknown</option>
          <option value="allowed">Allowed</option>
          <option value="prohibited">Prohibited</option>
        </select>
      </Field>
    </CommandForm>
  );
}
export function ActivityForm({ destination, saved }: Props) {
  return (
    <CommandForm
      label="Record completed activity"
      onSuccess={saved}
      build={(d) => ({
        type: "record_activity",
        destinationId: destination.id,
        activity: value(d, "activity"),
        occurredAt: timestamp(d, "occurred"),
        evidenceUrl: optional(d, "evidence"),
        prospectId: optional(d, "prospect"),
      })}
    >
      <Field label="Completed action" name="activity">
        <select name="activity">
          <option value={destination.kind === "page" ? "followed" : "joined"}>
            {destination.kind === "page" ? "Followed" : "Joined"}
          </option>
          <option value="posted">Posted</option>
        </select>
      </Field>
      <Field
        label="Occurred at"
        name="occurred"
        type="datetime-local"
        required
      />
      <Field label="Evidence URL (if known)" name="evidence" type="url" />
      <Field label="Prospect ID (if known)" name="prospect" />
    </CommandForm>
  );
}
export function SourceForm({ destination, saved }: Props) {
  return (
    <CommandForm
      label="Save prospect"
      onSuccess={saved}
      build={(d) => ({
        type: "capture_source",
        destinationId: destination.id,
        source: {
          sourceType: value(d, "sourceType"),
          sourceUrl: value(d, "source"),
          businessName: value(d, "business"),
          countryCode: value(d, "country").toUpperCase(),
          corporateType: optional(d, "corporate"),
          registrationNumber: optional(d, "registration"),
          firstName: optional(d, "first"),
          lastName: optional(d, "last"),
          email: optional(d, "email"),
          opportunity: value(d, "opportunity"),
          offer: value(d, "offer"),
          observedAt: timestamp(d, "observed"),
        },
      })}
    >
      <Field label="Source type" name="sourceType">
        <select name="sourceType" defaultValue={`facebook_${destination.kind}`}>
          <option value="facebook_page">Facebook page</option>
          <option value="facebook_group">Facebook group</option>
        </select>
      </Field>
      <p>Source type must match the destination.</p>
      <Field label="Public source URL" name="source" type="url" required />
      <Field label="Business name" name="business" required />
      <Field label="Country code (e.g. GB)" name="country" required />
      <Field label="Corporate type (if known)" name="corporate" />
      <Field label="Registration number (if known)" name="registration" />
      <Field label="First name (if known)" name="first" />
      <Field label="Last name (if known)" name="last" />
      <Field label="Email (if known)" name="email" type="email" />
      <Field label="Opportunity" name="opportunity" required />
      <Field label="Offer" name="offer" required />
      <Field
        label="Observed at"
        name="observed"
        type="datetime-local"
        required
      />
    </CommandForm>
  );
}
export function LinkForm({ destination, saved }: Props) {
  return (
    <CommandForm
      label="Link prospect"
      onSuccess={saved}
      build={(d) => {
        const input = value(d, "prospect");
        return {
          type: "link_prospect",
          destinationId: destination.id,
          prospectId: input.split("/").filter(Boolean).pop() ?? input,
        };
      }}
    >
      <Field label="CRM prospect URL or ID" name="prospect" required />
    </CommandForm>
  );
}
