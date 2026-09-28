"use client";

import { useState, type FormEvent } from "react";
import { parseOnboardingTemplateDraft } from "@/lib/operations/onboarding/workspace-schema";
import {
  welcomePackContentSchema,
  type WelcomePack,
  type WelcomePackContent,
} from "@/lib/operations/onboarding/welcome-packs";
import {
  Notice,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
  PortalTextarea,
  StatusBadge,
} from "@/components/portal/ui";
import { JourneyChecklistEditor } from "./journey-checklist-editor";

function sample(value: string): string {
  return value
    .replaceAll("{{client_name}}", "Northstar Studio")
    .replaceAll("{{contact_first_name}}", "Alex")
    .replaceAll("{{agreement_goal}}", "a clearer customer enquiry journey")
    .replaceAll(
      "{{agreement_scope}}",
      "the website and agreed delivery support",
    )
    .replaceAll("{{sender_name}}", "Jean-Fidele");
}

function responseError(body: unknown): string {
  return body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : "The welcome pack could not be saved. Refresh and try again.";
}

function isResult(
  body: unknown,
): body is { kind: string; draftVersion?: number; version?: number } {
  return (
    body !== null &&
    typeof body === "object" &&
    "kind" in body &&
    typeof body.kind === "string"
  );
}

export function WelcomePackEditor({
  packs,
}: Readonly<{ packs: readonly WelcomePack[] }>): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string>(packs[0]?.id ?? "");
  const selected = packs.find((pack) => pack.id === selectedId) ?? packs[0];
  const [content, setContent] = useState<WelcomePackContent | null>(
    selected?.content ?? null,
  );
  const [expectedVersion, setExpectedVersion] = useState(
    selected?.draftVersion ?? 1,
  );
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewReference, setReviewReference] = useState("");

  function choosePack(id: string): void {
    const pack = packs.find((item) => item.id === id);
    if (!pack) return;
    setSelectedId(id);
    setContent(pack.content);
    setExpectedVersion(pack.draftVersion);
    setSavedVersion(null);
    setMessage(null);
  }

  function updateContent(patch: Partial<WelcomePackContent>): void {
    setSavedVersion(null);
    setContent((current) => (current ? { ...current, ...patch } : current));
  }

  function setGuideText(
    index: number,
    field: "title" | "paragraphs",
    value: string,
  ): void {
    if (!content) return;
    const guide = content.guide.map((page, pageIndex) => {
      if (pageIndex !== index) return page;
      return field === "title"
        ? { ...page, title: value }
        : {
            ...page,
            paragraphs: value
              .split(/\n\s*\n/)
              .map((item) => item.trim())
              .filter(Boolean),
          };
    });
    updateContent({ guide });
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected || !content || pending) return;
    try {
      const validated = welcomePackContentSchema.parse(content);
      parseOnboardingTemplateDraft({
        name: selected.title,
        tasks: validated.tasks,
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Review the pack fields.",
      );
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/portal/admin/welcome/packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          packId: selected.id,
          content,
          expectedVersion,
          reviewReference,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(responseError(body));
        return;
      }
      if (!isResult(body) || typeof body.draftVersion !== "number") {
        setMessage(
          "The saved version response was incomplete. Refresh and try again.",
        );
        return;
      }
      setExpectedVersion(body.draftVersion);
      setSavedVersion(body.draftVersion);
      setMessage(`Draft version ${body.draftVersion} saved.`);
    } catch {
      setMessage(
        "The welcome pack could not be saved. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function publish(): Promise<void> {
    if (!selected || !savedVersion || pending) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/portal/admin/welcome/packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          packId: selected.id,
          expectedDraftVersion: savedVersion,
          reviewReference,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(responseError(body));
        return;
      }
      if (!isResult(body) || typeof body.version !== "number") {
        setMessage(
          "The published version response was incomplete. Refresh and try again.",
        );
        return;
      }
      setSavedVersion(null);
      setExpectedVersion((current) => current + 1);
      setMessage(
        `Published version ${body.version}. Refresh to load it into client journeys.`,
      );
    } catch {
      setMessage(
        "The welcome pack could not be published. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (!selected || !content)
    return <Notice tone="info">No welcome packs are available.</Notice>;

  return (
    <section aria-label="Shared welcome pack editor">
      <PortalCard
        description="Edit a shared client welcome, preview it with sample details, and publish an immutable version for future journeys."
        title="Shared welcome packs"
        tone="accent"
      >
        <PortalSelect
          label="Welcome pack"
          onChange={(event) => choosePack(event.target.value)}
          value={selected.id}
        >
          {packs.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.title}
            </option>
          ))}
        </PortalSelect>
        <p>
          Draft {expectedVersion} · {selected.versions.length} published version
          {selected.versions.length === 1 ? "" : "s"}
        </p>
        <ul aria-label="Published pack versions">
          {selected.versions.slice(0, 5).map((version) => (
            <li key={version.id}>
              <StatusBadge status="success">
                Version {version.version}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </PortalCard>

      <form onSubmit={save} aria-busy={pending}>
        <PortalCard title="Welcome email">
          <PortalField label="Email subject" required>
            <input
              maxLength={160}
              onChange={(event) =>
                updateContent({ emailSubject: event.target.value })
              }
              required
              value={content.emailSubject}
            />
          </PortalField>
          <PortalTextarea
            label="Email copy"
            maxLength={6_000}
            onChange={(event) =>
              updateContent({ emailBody: event.target.value })
            }
            required
            rows={10}
            value={content.emailBody}
          />
        </PortalCard>
        <PortalCard title="Five-page welcome guide">
          {content.guide.map((page, index) => (
            <fieldset key={`${selected.id}-${index}`} disabled={pending}>
              <legend>Guide section {index + 1}</legend>
              <PortalField label="Section title" required>
                <input
                  maxLength={100}
                  onChange={(event) =>
                    setGuideText(index, "title", event.target.value)
                  }
                  required
                  value={page.title}
                />
              </PortalField>
              <PortalTextarea
                hint="Separate paragraphs with a blank line."
                label="Section copy"
                maxLength={6_000}
                onChange={(event) =>
                  setGuideText(index, "paragraphs", event.target.value)
                }
                required
                rows={4}
                value={page.paragraphs.join("\n\n")}
              />
            </fieldset>
          ))}
        </PortalCard>
        <PortalCard title="After signing">
          <PortalField label="Thank-you subject" required>
            <input
              maxLength={200}
              onChange={(event) =>
                updateContent({
                  thankYou: {
                    ...content.thankYou,
                    subject: event.target.value,
                  },
                })
              }
              required
              value={content.thankYou.subject}
            />
          </PortalField>
          <PortalTextarea
            label="Opening"
            maxLength={6_000}
            onChange={(event) =>
              updateContent({
                thankYou: { ...content.thankYou, intro: event.target.value },
              })
            }
            required
            rows={3}
            value={content.thankYou.intro}
          />
          <PortalTextarea
            label="Next step"
            maxLength={6_000}
            onChange={(event) =>
              updateContent({
                thankYou: { ...content.thankYou, nextStep: event.target.value },
              })
            }
            required
            rows={3}
            value={content.thankYou.nextStep}
          />
          <PortalTextarea
            label="Client action"
            maxLength={6_000}
            onChange={(event) =>
              updateContent({
                thankYou: {
                  ...content.thankYou,
                  requiredAction: event.target.value,
                },
              })
            }
            required
            rows={3}
            value={content.thankYou.requiredAction}
          />
        </PortalCard>
        <PortalCard title="Client checklist">
          <JourneyChecklistEditor
            tasks={content.tasks}
            onChange={(tasks) => updateContent({ tasks })}
          />
        </PortalCard>
        <PortalCard title="Review record">
          <PortalField label="Review reference" required>
            <input
              disabled={pending}
              maxLength={200}
              name="reviewReference"
              onChange={(event) => setReviewReference(event.target.value)}
              required
              value={reviewReference}
            />
          </PortalField>
        </PortalCard>
        <PortalCard title="Sample preview">
          <h3>{sample(content.emailSubject)}</h3>
          {sample(content.emailBody)
            .split("\n\n")
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          {content.guide.map((page) => (
            <section key={page.title}>
              <h3>{page.title}</h3>
              {page.paragraphs.map((paragraph, index) => (
                <p key={index}>{sample(paragraph)}</p>
              ))}
            </section>
          ))}
          <section>
            <h3>{sample(content.thankYou.subject)}</h3>
            <p>{sample(content.thankYou.intro)}</p>
            <p>{sample(content.thankYou.nextStep)}</p>
            <p>{sample(content.thankYou.requiredAction)}</p>
          </section>
          <section>
            <h3>Client checklist</h3>
            <ul>
              {content.tasks.map((task) => (
                <li key={task.id}>
                  <strong>{task.title}</strong>: {task.instructions}
                </li>
              ))}
            </ul>
          </section>
        </PortalCard>
        <PortalButton disabled={pending} loading={pending} type="submit">
          Save draft
        </PortalButton>
        <PortalButton
          disabled={pending || !savedVersion}
          onClick={() => void publish()}
          type="button"
          variant="secondary"
        >
          Publish reviewed version
        </PortalButton>
        {message ? <p role="status">{message}</p> : null}
      </form>
    </section>
  );
}
