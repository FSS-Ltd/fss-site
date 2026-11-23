import type { CampaignOverviewRow } from "@/lib/growth/dashboard/campaign-overview";
import styles from "./campaign-overview.module.css";

type Policy = NonNullable<CampaignOverviewRow["editorPolicy"]>;

function EvidenceFields({
  prefix,
  title,
  value,
}: {
  prefix: string;
  title: string;
  value?: Policy["capabilityAttestation"];
}) {
  return (
    <fieldset className={styles.fieldGroup}>
      <legend>{title}</legend>
      <label>
        Evidence summary
        <textarea
          name={`${prefix}Summary`}
          required
          maxLength={2000}
          defaultValue={value?.summary ?? ""}
        />
      </label>
      <label>
        Reference type
        <select
          name={`${prefix}Kind`}
          defaultValue={value?.reference.kind ?? "private"}
        >
          <option value="private">Private reference</option>
          <option value="public">Public URL</option>
        </select>
      </label>
      <label>
        Evidence reference
        <input
          name={`${prefix}Reference`}
          required
          maxLength={500}
          defaultValue={value?.reference.value ?? ""}
        />
      </label>
      <label>
        Observed at (ISO time with offset)
        <input
          name={`${prefix}Observed`}
          required
          placeholder="2026-11-23T09:00:00Z"
          defaultValue={value?.observedAt ?? ""}
        />
      </label>
      <label>
        Expires at (ISO time with offset)
        <input
          name={`${prefix}Expires`}
          required
          placeholder="2026-12-23T09:00:00Z"
          defaultValue={value?.expiresAt ?? ""}
        />
      </label>
    </fieldset>
  );
}

export function CampaignPolicyFields({ policy }: { policy: Policy | null }) {
  return (
    <div className={styles.policyFields}>
      <fieldset className={styles.fieldGroup}>
        <legend>Offer and market</legend>
        <label>
          Offer
          <select name="offer" required defaultValue={policy?.offer ?? ""}>
            <option value="" disabled>
              Choose an offer
            </option>
            <option value="lead_review_essentials_v1">
              Lead &amp; Review Essentials · £297/month
            </option>
            <option value="booking_recovery_v1">
              Booking &amp; Recovery · £497/month
            </option>
            <option value="ai_front_desk_v1">AI Front Desk · £797/month</option>
            <option value="review">Review plan</option>
            <option value="website_preview">Private website preview</option>
          </select>
        </label>
        <p>
          Lead &amp; Review Essentials covers enquiry follow-up, an appointment
          assistant and Google review requests. Booking &amp; Recovery covers
          unanswered quotes, missed appointments and repeat business. AI Front
          Desk covers managed inbound calls, qualification, booking and human
          handover.
        </p>
        <p>
          Monthly offers include the entire website build excluding GoHighLevel
          add-ons, no setup fee, no minimum term and cancellation anytime. The
          selected terms are saved with the draft.
        </p>
        <label>
          Jurisdiction (two-letter country code)
          <input
            name="jurisdiction"
            required
            minLength={2}
            maxLength={2}
            defaultValue={policy?.jurisdiction ?? ""}
          />
        </label>
        <label>
          Provider
          <select name="provider" defaultValue={policy?.provider ?? "gmail"}>
            <option value="gmail">Gmail</option>
            <option value="resend">Resend</option>
          </select>
        </label>
        <label>
          Recipient permission required
          <select
            name="permission"
            required
            defaultValue={policy?.permissionRequirement ?? ""}
          >
            <option value="" disabled>
              Choose a requirement
            </option>
            <option value="consent">Consent</option>
            <option value="requested_service">Requested service</option>
          </select>
        </label>
        <p>
          {policy?.accountConnectionId
            ? "The existing account binding will be retained. Changing its provider is unavailable here."
            : "No account is bound. Binding and account readiness are separate steps."}
        </p>
      </fieldset>
      <fieldset className={styles.fieldGroup}>
        <legend>Policy timing and limits</legend>
        <p>
          New drafts use the London weekday 09:00–17:00 window, a 25 daily
          ceiling and a reserve of 50. Existing settings are retained on
          revision.
        </p>
        <label>
          Effective at (ISO time with offset)
          <input
            name="effectiveAt"
            required
            placeholder="2026-11-23T09:00:00Z"
            defaultValue={policy?.effectiveAt ?? ""}
          />
        </label>
        <label>
          Policy expires at (ISO time with offset)
          <input
            name="expiresAt"
            required
            placeholder="2026-12-23T09:00:00Z"
            defaultValue={policy?.expiresAt ?? ""}
          />
        </label>
        <label>
          Hard bounce halt threshold
          <input
            name="hardBounces"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={policy?.haltThresholds?.hardBounces ?? ""}
          />
        </label>
        <label>
          Complaint halt threshold
          <input
            name="complaints"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={policy?.haltThresholds?.complaints ?? ""}
          />
        </label>
      </fieldset>
      <fieldset className={styles.fieldGroup}>
        <legend>Two calls to action</legend>
        <p>Use two distinct questions for the same offer and conditions.</p>
        <label>
          Variant A
          <input
            name="ctaA"
            pattern=".*\?"
            title="End the call to action with a question mark."
            required
            maxLength={500}
            defaultValue={policy?.variants[0]?.cta ?? ""}
          />
        </label>
        <label>
          Variant B
          <input
            name="ctaB"
            pattern=".*\?"
            title="End the call to action with a question mark."
            required
            maxLength={500}
            defaultValue={policy?.variants[1]?.cta ?? ""}
          />
        </label>
      </fieldset>
      <EvidenceFields
        prefix="capability"
        title="Capability evidence"
        value={policy?.capabilityAttestation}
      />
      <EvidenceFields
        prefix="providerEvidence"
        title="Provider and jurisdiction evidence"
        value={policy?.providerAttestation}
      />
      <label className={styles.checkbox}>
        <input type="checkbox" name="providerConfirmed" required /> I confirm
        the provider evidence applies to the selected provider and jurisdiction.
      </label>
    </div>
  );
}
