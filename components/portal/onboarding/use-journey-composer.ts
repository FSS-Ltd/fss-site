"use client";
import { useRef, useState } from "react";
import { useUnsavedWelcomeChanges } from "./use-unsaved-welcome-changes";
import type { PortalRole } from "@/lib/operations/auth/types";
import type { JourneyBuilderStage } from "@/lib/operations/onboarding/builder-stage";
import type { OnboardingWorkspaceJourneyDraft } from "@/lib/operations/onboarding/workspace-types";
import type {
  WelcomePack,
  WelcomePackContent,
} from "@/lib/operations/onboarding/welcome-pack-contract";
import { resolveWelcomePack } from "@/lib/operations/onboarding/welcome-personalisation";
import type { JourneyComposerProps } from "./journey-composer-types";

function errorText(body: unknown): string {
  return body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : "The operation could not be confirmed. Your edits are still here.";
}
export function useJourneyComposer(props: JourneyComposerProps) {
  const saved = props.drafts?.[0];
  const [legacyCopy, setLegacyCopy] = useState(
    saved?.content?.composer ? null : (saved?.content ?? null),
  );
  const [stage, setStage] = useState<JourneyBuilderStage>(
    props.initialStage ?? saved?.stage ?? "setup",
  );
  const [agreementId, setAgreementId] = useState(
    saved?.agreementId ?? props.agreements[0]?.id ?? "",
  );
  const [contactId, setContactId] = useState(
    saved?.contactId ?? props.contacts[0]?.id ?? "",
  );
  const [templateId, setTemplateId] = useState(
    saved?.templateVersionId ?? props.templates[0]?.id ?? "",
  );
  const [role, setRole] = useState<PortalRole>(saved?.recipientRole ?? "owner");
  const [packet, setPacket] = useState<WelcomePackContent | null>(
    saved?.content?.composer?.packet ?? null,
  );
  const [packVersionId, setPackVersionId] = useState(
    saved?.content?.composer?.packVersionId ?? "",
  );
  const [obligationKey, setObligationKey] = useState(
    saved?.content?.composer?.obligationKey ?? "",
  );
  const [settingsRevision, setSettingsRevision] = useState(
    saved?.content?.composer?.settingsRevision ?? props.settings?.revision ?? 0,
  );
  const [draftId, setDraftId] = useState(saved?.id ?? "");
  const [version, setVersion] = useState(saved?.version ?? 0);
  const [packetAgreementId, setPacketAgreementId] = useState(
    saved?.agreementId ?? "",
  );
  const [packetContactId, setPacketContactId] = useState(
    saved?.contactId ?? "",
  );
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const stableDraftId = useRef(saved?.id ?? null);
  const agreement = props.agreementRecords?.find((a) => a.id === agreementId);
  const selection = props.agreements.find((a) => a.id === agreementId);
  const contact = props.contacts.find((c) => c.id === contactId);
  useUnsavedWelcomeChanges(dirty, pending);
  function changePacket(next: WelcomePackContent): void {
    setPacket(next);
    setDirty(true);
  }
  function newDraft(): void {
    stableDraftId.current = null;
    setDraftId("");
    setVersion(0);
    setPacket(null);
    setPackVersionId("");
    setObligationKey("");
    setStage("setup");
    setDirty(false);
    setLegacyCopy(null);
    setMessage("New journey ready for setup.");
  }
  function restore(draft: OnboardingWorkspaceJourneyDraft): void {
    setLegacyCopy(draft.content?.composer ? null : (draft.content ?? null));
    stableDraftId.current = draft.id;
    setPacketAgreementId(draft.agreementId);
    setPacketContactId(draft.contactId);
    setDraftId(draft.id);
    setVersion(draft.version);
    setAgreementId(draft.agreementId);
    setContactId(draft.contactId);
    setTemplateId(draft.templateVersionId);
    setRole(draft.recipientRole ?? "owner");
    setStage(draft.stage);
    setPacket(draft.content?.composer?.packet ?? null);
    setPackVersionId(draft.content?.composer?.packVersionId ?? "");
    setObligationKey(draft.content?.composer?.obligationKey ?? "");
    setSettingsRevision(
      draft.content?.composer?.settingsRevision ??
        props.settings?.revision ??
        0,
    );
    setDirty(false);
    setMessage(
      "Saved draft restored. Review the current agreement and settings before preparing.",
    );
  }
  async function choosePack(pack: WelcomePack): Promise<void> {
    const published = pack.versions[0];
    if (busy.current) return;
    if (!published) {
      setMessage(
        "Publish this packet in the template library before using it.",
      );
      return;
    }
    if (!agreement || !contact) {
      setMessage("Select a current agreement and contact in Setup first.");
      return;
    }
    let resolved: WelcomePackContent;
    try {
      resolved = resolveWelcomePack(
        published.content,
        {
          client_name: props.organisationName ?? "",
          contact_first_name: contact.name.split(/\s+/)[0] ?? "",
          agreement_goal: agreement.draft.goals,
          agreement_scope: agreement.draft.scope,
          sender_name:
            props.settings?.displayName ?? "Faithful Software Solutions",
        },
        props.settings?.responseExpectationHours ?? 48,
        {
          responsibilities: agreement.draft.responsibilities,
          support: agreement.draft.support,
          serviceDates: `Service dates recorded in your agreement: ${agreement.draft.lines.map((line) => `${line.description}: starts ${line.startDate}${line.endDate ? `, ends ${line.endDate}` : ""}`).join("; ")}. These service dates do not confirm project review milestones.`,
        },
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Complete the project facts first.",
      );
      return;
    }
    if (legacyCopy)
      resolved = {
        ...resolved,
        emailSubject: legacyCopy.welcomeSubject || resolved.emailSubject,
        emailBody: legacyCopy.welcomeBody || resolved.emailBody,
      };
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/portal/admin/welcome/packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "apply_to_client",
          organisationId: props.organisationId,
          packVersionId: published.id,
          reviewReference:
            "Selected welcome packet and complete client checklist",
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorText(body));
      if (
        !body ||
        typeof body !== "object" ||
        !("kind" in body) ||
        body.kind !== "welcome_pack_applied" ||
        !("templateVersionId" in body) ||
        typeof body.templateVersionId !== "string"
      )
        throw new Error(
          "The client checklist was not confirmed. Refresh before continuing.",
        );
      setTemplateId(body.templateVersionId);
      setPacketAgreementId(agreementId);
      setPacketContactId(contactId);
      setPacket(resolved);
      setPackVersionId(published.id);
      setSettingsRevision(props.settings?.revision ?? 0);
      setDirty(true);
      setMessage("Packet content and its complete checklist applied together.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The packet could not be applied.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function makeWelcome() {
    if (
      !packet ||
      !agreement ||
      !contact ||
      !props.billing ||
      !props.settings?.replyTo ||
      !obligationKey
    )
      throw new Error(
        "Complete the packet, recipient, approved reply-to and agreed invoice before review.",
      );
    if (packetAgreementId !== agreementId || packetContactId !== contactId)
      throw new Error(
        "The agreement or contact changed. Select the packet again to personalise the current facts.",
      );
    if (settingsRevision !== props.settings.revision)
      throw new Error(
        "Settings changed since this packet was prepared. Select the packet again to apply current values.",
      );
    return {
      recipient: contact.email,
      invoice: { ...props.billing, obligationKey },
      content: {
        rendererVersion: packet.rendererVersion,
        edition: packet.edition,
        settingsRevision,
        timezone: props.settings.timezone,
        responseExpectationHours: props.settings.responseExpectationHours,
        contactFirstName: contact.name.split(/\s+/)[0] ?? contact.name,
        primaryGoal: agreement.draft.goals,
        outcomeSummary: agreement.draft.scope,
        senderName: props.settings.displayName,
        organisationName: "Faithful Software Solutions",
        clientOrganisationName: props.organisationName,
        from: "hello@faithfulsoftwaresolutions.co.uk",
        replyTo: props.settings.replyTo,
        welcomePackVersionId: packVersionId,
        emailSubject: packet.emailSubject,
        emailBody: packet.emailBody,
        pages: packet.guide,
      },
      thankYou: packet.thankYou,
    };
  }
  async function save(
    reviewed = false,
  ): Promise<{ draftId: string; version: number } | null> {
    if (busy.current) return null;
    if (!selection || !contact || !templateId || !packet) {
      setMessage(
        "Select an agreement, contact and packet before saving the journey.",
      );
      return null;
    }
    if (packetAgreementId !== agreementId || packetContactId !== contactId) {
      setMessage(
        "Select the packet again to apply the changed agreement or contact before saving.",
      );
      return null;
    }
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const id = stableDraftId.current ?? crypto.randomUUID();
      stableDraftId.current = id;
      setDraftId(id);
      const welcome = reviewed ? makeWelcome() : undefined;
      const response = await fetch(props.commandEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save_journey_draft",
          draftId: id,
          agreementId,
          contactId,
          templateVersionId: templateId,
          expectedAgreementVersion: selection.version,
          expectedVersion: version,
          recipientRole: role,
          stage,
          reviewReference: reviewed
            ? "Reviewed exact client welcome packet"
            : "Saved client welcome workspace",
          content: {
            welcomeSubject: packet.emailSubject,
            welcomeBody: packet.emailBody,
            composer: {
              packet,
              packVersionId,
              obligationKey,
              settingsRevision,
            },
            ...(welcome ? { reviewedWelcome: welcome } : {}),
          },
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorText(body));
      if (
        !body ||
        typeof body !== "object" ||
        !("kind" in body) ||
        body.kind !== "journey_draft" ||
        !("draftId" in body) ||
        typeof body.draftId !== "string" ||
        !("version" in body) ||
        typeof body.version !== "number"
      )
        throw new Error("The saved draft was not confirmed.");
      setDraftId(body.draftId);
      setVersion(body.version);
      setDirty(false);
      setMessage(`Draft version ${body.version} saved.`);
      return { draftId: body.draftId, version: body.version };
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The draft could not be saved.",
      );
      return null;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function prepare(
    onPreview: (command: unknown) => Promise<void>,
  ): Promise<void> {
    try {
      const welcome = makeWelcome();
      const stored = await save(true);
      if (!stored) return;
      await onPreview({
        action: "preview_welcome",
        agreementId,
        expectedVersion: selection?.version,
        welcome,
        workspace: {
          contactId,
          draftId: stored.draftId,
          expectedDraftVersion: stored.version,
          recipientRole: role,
          templateVersionId: templateId,
        },
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The welcome could not be prepared.",
      );
    }
  }
  return {
    stage,
    setStage,
    agreementId,
    setAgreementId,
    contactId,
    setContactId,
    templateId,
    setTemplateId,
    role,
    setRole,
    packet,
    changePacket,
    packVersionId,
    obligationKey,
    setObligationKey,
    pending,
    message,
    dirty,
    setDirty,
    version,
    draftId,
    newDraft,
    restore,
    choosePack,
    save,
    prepare,
    agreement,
    contact,
  };
}
