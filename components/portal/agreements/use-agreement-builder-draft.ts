"use client";

import { useRef, useState } from "react";
import type {
  AgreementBuilderDraftContent,
  AgreementBuilderStep,
} from "@/lib/operations/agreements/builder-draft-schema";
import type { AgreementBuilderDraft } from "@/lib/operations/agreements/builder-draft-service";

type DraftRouteResponse = Readonly<{
  content: AgreementBuilderDraftContent;
  id: string;
  step: AgreementBuilderStep;
  version: number;
}>;

export type AgreementBuilderFeedback =
  | Readonly<{ tone: "success"; message: string }>
  | Readonly<{ tone: "error"; message: string }>;

type FinalisedAgreementResponse = Readonly<{ id: string }>;

export type SavedAgreementBuilderDraft = Readonly<
  Pick<AgreementBuilderDraft, "content" | "id" | "step" | "version">
>;

function errorMessage(body: unknown, fallback: string): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return fallback;
}

function isDraftRouteResponse(value: unknown): value is DraftRouteResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    "content" in value &&
    "id" in value &&
    typeof value.id === "string" &&
    "step" in value &&
    typeof value.step === "string" &&
    "version" in value &&
    typeof value.version === "number"
  );
}

function isFinalisedAgreementResponse(
  value: unknown,
): value is FinalisedAgreementResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  );
}

export function useAgreementBuilderDraft({
  agreementListHref,
  baseHref,
  commandEndpoint,
  initialDraft,
  navigate,
}: Readonly<{
  agreementListHref: string;
  baseHref: string;
  commandEndpoint: string;
  initialDraft: AgreementBuilderDraft | null;
  navigate?: (href: string) => void;
}>): Readonly<{
  draft: SavedAgreementBuilderDraft | null;
  finalise: () => Promise<void>;
  feedback: AgreementBuilderFeedback | null;
  pending: boolean;
  pendingMessage: string;
  save: (
    step: AgreementBuilderStep,
    content: AgreementBuilderDraftContent,
  ) => Promise<SavedAgreementBuilderDraft | null>;
}> {
  const draftId = useRef(initialDraft?.id ?? null);
  const [draft, setDraft] = useState<SavedAgreementBuilderDraft | null>(
    initialDraft
      ? {
          content: initialDraft.content,
          id: initialDraft.id,
          step: initialDraft.step,
          version: initialDraft.version,
        }
      : null,
  );
  const [feedback, setFeedback] = useState<AgreementBuilderFeedback | null>(
    null,
  );
  const requestInFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState("Saving draft…");

  async function request(payload: unknown, fallback: string): Promise<unknown> {
    const response = await fetch(commandEndpoint, {
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => {
      throw new Error(fallback);
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(body, fallback));
    return body;
  }

  async function save(
    step: AgreementBuilderStep,
    content: AgreementBuilderDraftContent,
  ): Promise<SavedAgreementBuilderDraft | null> {
    if (requestInFlight.current) return null;
    requestInFlight.current = true;
    const nextDraftId = draftId.current ?? crypto.randomUUID();
    setPendingMessage("Saving draft…");
    setPending(true);
    setFeedback(null);
    try {
      const response = await request(
        {
          action: "save",
          content,
          draftId: nextDraftId,
          expectedVersion: draft?.version ?? 0,
          step,
        },
        "The agreement draft could not be saved. Your edits are still here. Please try again.",
      );
      if (!isDraftRouteResponse(response)) {
        throw new Error(
          "The saved draft response was incomplete. Refresh and try again.",
        );
      }
      draftId.current = response.id;
      const nextDraft: SavedAgreementBuilderDraft = {
        content: response.content,
        id: response.id,
        step: response.step,
        version: response.version,
      };
      setDraft(nextDraft);
      window.history.pushState(
        {},
        "",
        `${baseHref}?${new URLSearchParams({
          draftId: response.id,
          step: response.step,
        }).toString()}`,
      );
      setFeedback({ tone: "success", message: "Draft saved." });
      return nextDraft;
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The agreement draft could not be saved. Please try again.",
      });
      return null;
    } finally {
      requestInFlight.current = false;
      setPending(false);
    }
  }

  async function finalise(): Promise<void> {
    if (!draftId.current || !draft) {
      setFeedback({
        tone: "error",
        message:
          "Save the agreement draft before creating its agreement record.",
      });
      return;
    }
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setPendingMessage(
      draft.content.commercialOffer
        ? "Publishing payment offer…"
        : "Creating agreement…",
    );
    setPending(true);
    setFeedback(null);
    const failureMessage = draft.content.commercialOffer
      ? "The payment offer could not be published. Your saved draft is still available. Please try again."
      : "The agreement could not be created. Your saved draft is still available. Please try again.";
    try {
      const response = await request(
        {
          action: draft.content.commercialOffer ? "publish" : "finalise",
          draftId: draftId.current,
          expectedVersion: draft.version,
        },
        failureMessage,
      );
      if (!isFinalisedAgreementResponse(response)) {
        throw new Error(
          "The agreement response was incomplete. Refresh and try again.",
        );
      }
      const destination = draft.content.commercialOffer
        ? `${agreementListHref.replace(/\/agreements$/, "/commercial-offers")}/${encodeURIComponent(response.id)}`
        : `${agreementListHref}/${encodeURIComponent(response.id)}`;
      if (!navigate) {
        setFeedback({
          tone: "success",
          message: "Agreement created. Reload this page to open its record.",
        });
        return;
      }
      navigate(destination);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : failureMessage,
      });
    } finally {
      requestInFlight.current = false;
      setPending(false);
    }
  }

  return { draft, finalise, feedback, pending, pendingMessage, save };
}
