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

type FinalisedAgreementResponse = Readonly<{ id: string }>;

export type SavedAgreementBuilderDraft = Readonly<
  Pick<AgreementBuilderDraft, "content" | "id" | "step" | "version">
>;

function errorMessage(body: unknown): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return "The agreement draft could not be saved. Please try again.";
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
  message: string | null;
  pending: boolean;
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
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function request(payload: unknown): Promise<unknown> {
    const response = await fetch(commandEndpoint, {
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(body));
    return body;
  }

  async function save(
    step: AgreementBuilderStep,
    content: AgreementBuilderDraftContent,
  ): Promise<SavedAgreementBuilderDraft | null> {
    const nextDraftId = draftId.current ?? crypto.randomUUID();
    setPending(true);
    setMessage(null);
    try {
      const response = await request({
        action: "save",
        content,
        draftId: nextDraftId,
        expectedVersion: draft?.version ?? 0,
        step,
      });
      if (!isDraftRouteResponse(response)) {
        throw new Error("The saved draft response was incomplete. Refresh and try again.");
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
      setMessage(`Draft version ${response.version} saved.`);
      return nextDraft;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The agreement draft could not be saved. Please try again.",
      );
      return null;
    } finally {
      setPending(false);
    }
  }

  async function finalise(): Promise<void> {
    if (!draftId.current || !draft) {
      setMessage("Save the agreement draft before creating its agreement record.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await request({
        action: "finalise",
        draftId: draftId.current,
        expectedVersion: draft.version,
      });
      if (!isFinalisedAgreementResponse(response)) {
        throw new Error("The agreement response was incomplete. Refresh and try again.");
      }
      const destination = `${agreementListHref}/${encodeURIComponent(response.id)}`;
      if (!navigate) {
        setMessage("Agreement created. Reload this page to open its record.");
        return;
      }
      navigate(destination);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The agreement could not be created. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return { draft, finalise, message, pending, save };
}
