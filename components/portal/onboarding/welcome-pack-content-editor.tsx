"use client";
import { useState } from "react";
import { PortalField, PortalTextarea } from "@/components/portal/ui";
import type { WelcomePackContent } from "@/lib/operations/onboarding/welcome-pack-contract";
import { JourneyChecklistEditor } from "./journey-checklist-editor";
import styles from "./welcome-packet.module.css";
export function WelcomePackContentEditor({
  content,
  onChange,
  disabled = false,
  editChecklist = true,
}: Readonly<{
  content: WelcomePackContent;
  onChange: (content: WelcomePackContent) => void;
  disabled?: boolean;
  editChecklist?: boolean;
}>): React.JSX.Element {
  const [section, setSection] = useState(0);
  const page = content.guide[section] ?? content.guide[0];
  function updatePage(field: "title" | "paragraphs", value: string): void {
    onChange({
      ...content,
      guide: content.guide.map((item, index) =>
        index === section
          ? {
              ...item,
              ...(field === "title"
                ? { title: value }
                : {
                    paragraphs: value
                      .split(/\n\s*\n/)
                      .map((p) => p.trim())
                      .filter(Boolean),
                  }),
            }
          : item,
      ),
    });
  }
  return (
    <fieldset disabled={disabled} className={styles.editor}>
      <legend>Packet content</legend>
      <details open>
        <summary>Welcome email</summary>
        <PortalField label="Email subject" required>
          <input
            value={content.emailSubject}
            maxLength={160}
            required
            onChange={(e) =>
              onChange({ ...content, emailSubject: e.target.value })
            }
          />
        </PortalField>
        <PortalTextarea
          label="Email copy"
          value={content.emailBody}
          maxLength={6000}
          required
          rows={7}
          onChange={(e) => onChange({ ...content, emailBody: e.target.value })}
        />
      </details>
      <details open>
        <summary>
          {content.rendererVersion === 2 ? "Ten-page packet" : "Welcome guide"}
        </summary>
        <div className={styles.sectionList} aria-label="Packet sections">
          {content.guide.map((item, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={section === index}
              onClick={() => setSection(index)}
            >
              {index + (content.rendererVersion === 2 ? 2 : 1)}. {item.title}
            </button>
          ))}
        </div>
        {page ? (
          <>
            <PortalField label="Section title" required>
              <input
                value={page.title}
                maxLength={100}
                required
                onChange={(e) => updatePage("title", e.target.value)}
              />
            </PortalField>
            <PortalTextarea
              label="Section copy"
              hint="Separate paragraphs with a blank line."
              value={page.paragraphs.join("\n\n")}
              required
              maxLength={6000}
              rows={8}
              onChange={(e) => updatePage("paragraphs", e.target.value)}
            />
          </>
        ) : null}
      </details>
      <details>
        <summary>After signing</summary>
        {(["subject", "intro", "nextStep", "requiredAction"] as const).map(
          (key) => (
            <PortalTextarea
              key={key}
              label={
                {
                  subject: "Thank-you subject",
                  intro: "Opening",
                  nextStep: "Next step",
                  requiredAction: "Client action",
                }[key]
              }
              value={content.thankYou[key]}
              rows={3}
              required
              maxLength={key === "subject" ? 200 : 2000}
              onChange={(e) =>
                onChange({
                  ...content,
                  thankYou: { ...content.thankYou, [key]: e.target.value },
                })
              }
            />
          ),
        )}
      </details>
      {editChecklist ? (
        <details>
          <summary>Client checklist</summary>
          <JourneyChecklistEditor
            tasks={content.tasks}
            onChange={(tasks) => onChange({ ...content, tasks })}
          />
        </details>
      ) : null}
    </fieldset>
  );
}
