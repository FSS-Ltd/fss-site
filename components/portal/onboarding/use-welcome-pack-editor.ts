"use client";
import { useRef, useState } from "react";
import { useUnsavedWelcomeChanges } from "./use-unsaved-welcome-changes";
import {
  welcomePackContentSchema,
  type WelcomePack,
  type WelcomePackContent,
} from "@/lib/operations/onboarding/welcome-pack-contract";
import { parseOnboardingTemplateDraft } from "@/lib/operations/onboarding/workspace-schema";

export function useWelcomePackEditor(pack: WelcomePack) {
  const [content, setContent] = useState<WelcomePackContent>(pack.content);
  const [savedContent, setSavedContent] = useState<WelcomePackContent>(
    pack.content,
  );
  const [publishedVersion, setPublishedVersion] = useState(
    pack.publishedVersion,
  );
  const [versions, setVersions] = useState(pack.versions);
  const [revision, setRevision] = useState(pack.draftVersion);
  const [savedRevision, setSavedRevision] = useState<number | null>(null);
  const [reviewReference, setReviewReference] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const busy = useRef(false);
  useUnsavedWelcomeChanges(dirty, pending);
  function update(next: WelcomePackContent): void {
    setContent(next);
    setDirty(true);
    setSavedRevision(null);
  }
  async function send(publish = false): Promise<void> {
    if (busy.current || (publish && !savedRevision)) return;
    try {
      welcomePackContentSchema.parse(content);
      parseOnboardingTemplateDraft({ name: pack.title, tasks: content.tasks });
      if (!reviewReference.trim())
        throw new Error("Add a review reference before saving.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Review the packet fields.",
      );
      return;
    }
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/portal/admin/welcome/packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          publish
            ? {
                action: "publish",
                packId: pack.id,
                expectedDraftVersion: savedRevision,
                reviewReference,
              }
            : {
                action: "save_draft",
                packId: pack.id,
                content,
                expectedVersion: revision,
                reviewReference,
              },
        ),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          result &&
            typeof result === "object" &&
            "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "The packet could not be saved. Your edits are still here.",
        );
      }
      if (!result || typeof result !== "object" || !("kind" in result))
        throw new Error(
          "The saved packet response was incomplete. Refresh before trying again.",
        );
      if (publish) {
        if (
          !("version" in result) ||
          typeof result.version !== "number" ||
          !("id" in result) ||
          typeof result.id !== "string"
        )
          throw new Error("The published version was not confirmed.");
        const publishedId = result.id;
        const confirmedVersion = result.version;
        setPublishedVersion(confirmedVersion);
        setVersions((current) => [
          {
            id: publishedId,
            version: confirmedVersion,
            content: savedContent,
            publishedAt: new Date().toISOString(),
          },
          ...current,
        ]);
        setRevision((r) => r + 1);
        setSavedRevision(null);
        setMessage(
          `Published version ${result.version}. New journeys can use this edition.`,
        );
      } else {
        if (
          !("draftVersion" in result) ||
          typeof result.draftVersion !== "number"
        )
          throw new Error("The saved draft version was not confirmed.");
        setSavedContent(content);
        setRevision(result.draftVersion);
        setSavedRevision(result.draftVersion);
        setMessage(`Draft version ${result.draftVersion} saved.`);
      }
      setDirty(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The packet could not be saved. Your edits are still here.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return {
    savedPack: {
      ...pack,
      content: savedContent,
      draftVersion: revision,
      publishedVersion,
      versions,
    },
    content,
    update,
    revision,
    savedRevision,
    reviewReference,
    setReviewReference,
    pending,
    message,
    dirty,
    send,
  };
}
