import { Notice, PortalSelect } from "@/components/portal/ui";
import { RequestField } from "./form-field";
import { scopeLabels } from "./presentation";
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
  documents,
}: {
  action: string;
  deliveryOwners: Choice[];
  agreements: Choice[];
  currentPriority: RequestPriority;
  documents?: Choice[];
}): React.JSX.Element {
  return (
    <>
      {action === "set_priority" && (
        <PortalSelect
          label="Operational priority"
          name="priority"
          defaultValue={currentPriority}
          hint="Internal delivery priority, assessed separately from the client’s reported impact."
          required
        >
          {requestPriorities.map((priority) => (
            <option key={priority} value={priority}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </option>
          ))}
        </PortalSelect>
      )}
      {action === "acknowledge" && (
        <>
          <PortalSelect label="Delivery owner" name="deliveryOwnerId" required>
            {deliveryOwners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.label}
              </option>
            ))}
          </PortalSelect>
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
          <PortalSelect
            label="Scope decision"
            name="scope"
            defaultValue="assessment_pending"
          >
            {Object.entries(scopeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </PortalSelect>
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
          <PortalSelect
            hint="Quote-required work needs an approved agreement before it can start."
            label="Approved agreement"
            name="agreementId"
          >
            <option value="">No new agreement required</option>
            {agreements.map((agreement) => (
              <option key={agreement.id} value={agreement.id}>
                {agreement.label}
              </option>
            ))}
          </PortalSelect>
        </>
      )}
      {action === "review" && (
        <>
          {documents ? (
            documents.length ? (
              <PortalSelect label="Deliverable" name="documentIds" required>
                <option disabled value="">
                  Choose a retained deliverable
                </option>
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.label}
                  </option>
                ))}
              </PortalSelect>
            ) : (
              <Notice tone="warning">
                Add or retain a deliverable in the request before publishing a
                review.
              </Notice>
            )
          ) : null}
          <RequestField
            name="deliverableVersion"
            label="Deliverable version"
            required
            maxLength={200}
          />
          <RequestField
            name="publicSummary"
            label="What changed"
            required
            multiline
            maxLength={4000}
          />
          <RequestField
            name="reviewInstructions"
            label="What to check"
            required
            multiline
            maxLength={4000}
            hint="Explain what to check and where to find the deliverable in the project documents."
          />
        </>
      )}
      {action === "revise" && (
        <>
          <PortalSelect label="Revision decision" name="revisionDecision">
            <option value="included">Included revision</option>
            <option value="assessment_pending">Assess additional scope</option>
          </PortalSelect>
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
      {(action === "public_update" || action === "internal_note") && (
        <RequestField
          name="body"
          label={
            action === "public_update" ? "Message to client" : "Internal note"
          }
          required
          multiline
          maxLength={10000}
        />
      )}
      {action === "comment" && (
        <>
          <PortalSelect
            defaultValue="internal"
            label="Who can see this?"
            name="visibility"
          >
            <option value="internal">FSS only</option>
            <option value="client">Client and FSS</option>
          </PortalSelect>
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
