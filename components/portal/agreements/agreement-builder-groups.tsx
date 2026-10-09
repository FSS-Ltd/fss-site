"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PortalCard } from "@/components/portal/ui";
import { FormActions } from "./agreement-builder-step-support";
import styles from "./agreement-builder.module.css";

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function invalidControl(
  container: Element,
  continueOnly = false,
): FormControl | undefined {
  return Array.from(
    container.querySelectorAll<FormControl>("input, select, textarea"),
  ).find(
    (control) =>
      control.willValidate &&
      !control.validity.valid &&
      (!continueOnly ||
        !control.closest("[data-builder-validate-on-save-only]")),
  );
}

function focusInvalidControl(control: FormControl): void {
  const details = control.closest("details");
  if (details) details.open = true;
  control.focus();
  control.reportValidity();
}

type AgreementBuilderGroupFlow = Readonly<{
  formRef: React.RefObject<HTMLFormElement | null>;
  index: number;
  direction: "forward" | "backward";
  next: () => boolean;
  read: (onInvalid?: (groupIndex: number) => void) => FormData | null;
  show: (index: number, invalid?: FormControl) => void;
  headingId: (index: number) => string;
}>;

export function useAgreementBuilderGroups(
  count: number,
): AgreementBuilderGroupFlow {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const index = Math.min(selectedIndex, Math.max(0, count - 1));
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const focusTarget = useRef<FormControl | null>(null);
  const id = useId();

  useEffect(() => {
    if (focusTarget.current) {
      focusInvalidControl(focusTarget.current);
      focusTarget.current = null;
    } else {
      formRef.current
        ?.querySelector<HTMLElement>(`[data-builder-group="${index}"] h2`)
        ?.focus();
    }
  }, [index]);

  function show(next: number, invalid?: FormControl): void {
    if (next === index) {
      if (invalid) focusInvalidControl(invalid);
      return;
    }
    focusTarget.current = invalid ?? null;
    setDirection(next < index ? "backward" : "forward");
    setSelectedIndex(next);
  }

  function next(): boolean {
    const group = formRef.current?.querySelector(
      `[data-builder-group="${index}"]`,
    );
    if (!group) return false;
    const invalid = invalidControl(group, true);
    if (invalid) {
      focusInvalidControl(invalid);
      return false;
    }
    if (index < count - 1) {
      show(index + 1);
      return false;
    }
    return true;
  }

  function read(onInvalid?: (groupIndex: number) => void): FormData | null {
    const form = formRef.current;
    if (!form) return null;
    const groups = form.querySelectorAll("[data-builder-group]");
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const invalid = invalidControl(groups[groupIndex]);
      if (invalid) {
        show(groupIndex, invalid);
        onInvalid?.(groupIndex);
        return null;
      }
    }
    return new FormData(form);
  }

  return {
    formRef,
    index,
    direction,
    next,
    read,
    show,
    headingId: (groupIndex: number) => `${id}-group-${groupIndex}`,
  };
}

export type AgreementBuilderGroup = Readonly<{
  title: string;
  description?: string;
  children: React.ReactNode;
}>;

export function AgreementBuilderGroupForm({
  flow: { formRef, index: activeIndex, direction, next, show, headingId },
  groups,
  pending,
  continueLabel,
  onContinue,
  onSave,
  onBack,
  backLabel,
  continueDisabled,
  continueDisabledReason,
  children,
}: Readonly<{
  flow: ReturnType<typeof useAgreementBuilderGroups>;
  groups: readonly AgreementBuilderGroup[];
  pending: boolean;
  continueLabel: string;
  onContinue: () => void;
  onSave: () => void;
  onBack?: () => void;
  backLabel?: string;
  continueDisabled?: boolean;
  continueDisabledReason?: string;
  children?: React.ReactNode;
}>): React.JSX.Element {
  return (
    <PortalCard className={styles.card}>
      <form
        className={styles.guidedForm}
        data-direction={direction}
        noValidate
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending && !continueDisabled && next()) onContinue();
        }}
      >
        <fieldset className={styles.controls} disabled={pending}>
          {groups.map((group, index) => (
            <section
              className={styles.groupPanel}
              data-builder-group={index}
              hidden={activeIndex !== index}
              aria-labelledby={headingId(index)}
              key={index}
            >
              <div className={styles.prompt}>
                <h2 id={headingId(index)} tabIndex={-1}>
                  {group.title}
                </h2>
                {group.description ? <p>{group.description}</p> : null}
              </div>
              <div className={styles.groupFields}>{group.children}</div>
            </section>
          ))}
        </fieldset>
        {children}
        <FormActions
          backLabel={activeIndex > 0 ? "Back" : backLabel}
          continueDisabled={continueDisabled}
          continueDisabledReason={continueDisabledReason}
          continueLabel={
            activeIndex === groups.length - 1 ? continueLabel : "Continue"
          }
          onBack={activeIndex > 0 ? () => show(activeIndex - 1) : onBack}
          onSave={onSave}
          pending={pending}
        />
      </form>
    </PortalCard>
  );
}
