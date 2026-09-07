import { RequestField } from "./form-field";
import { scopeLabels } from "./presentation";
import styles from "./requests.module.css";
import {
  requestPriorities,
  type RequestPriority,
} from "@/lib/operations/requests/types";

type Choice = { id: string; label: string };
export function FounderActionFields({
  action,
  deliveryOwners,
  agreements,
  currentPriority,
}: {
  action: string;
  deliveryOwners: Choice[];
  agreements: Choice[];
  currentPriority: RequestPriority;
}): React.JSX.Element {
  return (
    <>
      {action === "set_priority" && (
        <label className={styles.field}>
          Operational priority
          <select
            name="priority"
            className={styles.input}
            defaultValue={currentPriority}
            required
          >
            {requestPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </select>
          <span className={styles.note}>
            Internal delivery priority, assessed separately from the client’s
            reported impact.
          </span>
        </label>
      )}
      {action === "acknowledge" && (
        <>
          <label className={styles.field}>
            Delivery owner
            <select name="deliveryOwnerId" className={styles.input} required>
              {deliveryOwners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.label}
                </option>
              ))}
            </select>
          </label>
          <RequestField
            name="ownerDisplay"
            label="Owner shown to the client"
            required
            maxLength={160}
          />
        </>
      )}
      {(action === "acknowledge" || action === "classify_scope") && (
        <>
          <label className={styles.field}>
            Scope decision
            <select
              name="scope"
              className={styles.input}
              defaultValue="assessment_pending"
            >
              {Object.entries(scopeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <RequestField
            name="scopeReason"
            label="Scope explanation"
            multiline
            maxLength={4000}
            hint="Give a clear reason when declining work or requesting a quote."
          />
        </>
      )}
      {action === "plan" && (
        <>
          <RequestField
            name="nextAction"
            label="Next action"
            required
            multiline
            maxLength={4000}
          />
          <RequestField
            name="targetDate"
            label="Agreed target date"
            type="date"
          />
        </>
      )}
      {(action === "plan" || action === "classify_scope") && (
        <>
          <label className={styles.field}>
            Approved agreement
            <select name="agreementId" className={styles.input}>
              <option value="">No new agreement required</option>
              {agreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.label}
                </option>
              ))}
            </select>
            <span className={styles.note}>
              Quote-required work needs an approved agreement before it can
              start.
            </span>
          </label>
        </>
      )}
      {action === "review" && (
        <>
          <RequestField
            name="deliverableVersion"
            label="Deliverable version"
            required
            maxLength={200}
          />
          <RequestField
            name="publicSummary"
            label="Summary for the client"
            required
            multiline
            maxLength={4000}
          />
          <RequestField
            name="reviewInstructions"
            label="Review instructions"
            required
            multiline
            maxLength={4000}
            hint="Explain what to check and where to find the deliverable in the project documents."
          />
        </>
      )}
      {action === "revise" && (
        <>
          <label className={styles.field}>
            Revision decision
            <select name="revisionDecision" className={styles.input}>
              <option value="included">Included revision</option>
              <option value="assessment_pending">
                Assess additional scope
              </option>
            </select>
          </label>
          <RequestField
            name="reason"
            label="Decision reason"
            required
            multiline
            maxLength={4000}
          />
        </>
      )}
      {(action === "start" || action === "revise") && (
        <RequestField
          name="capacityOverrideReason"
          label="Capacity override reason"
          multiline
          maxLength={4000}
          hint="Only provide this when intentionally exceeding the delivery owner's work limit."
        />
      )}
      {["cancel", "close", "reopen"].includes(action) && (
        <RequestField
          name="reason"
          label="Reason"
          required
          multiline
          maxLength={4000}
          hint={
            action === "close"
              ? "This records ‘Closed by FSS’. It does not record client acceptance."
              : undefined
          }
        />
      )}
      {action === "block" && (
        <>
          <RequestField
            name="reason"
            label="What is blocking progress?"
            required
            multiline
            maxLength={4000}
          />
          <RequestField
            name="responsibleParty"
            label="Who needs to act?"
            required
            maxLength={160}
          />
          <RequestField
            name="nextCheckDate"
            label="Next check date"
            required
            type="date"
          />
        </>
      )}
      {action === "comment" && (
        <>
          <label className={styles.field}>
            Who can see this?
            <select
              name="visibility"
              className={styles.input}
              defaultValue="internal"
            >
              <option value="internal">FSS only</option>
              <option value="client">Client and FSS</option>
            </select>
          </label>
          <RequestField
            name="body"
            label="Comment"
            required
            multiline
            maxLength={10000}
          />
        </>
      )}
    </>
  );
}
