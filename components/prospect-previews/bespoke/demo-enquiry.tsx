"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { DemoFieldControl } from "./demo-field-control";
import type { DemoField } from "./demo-field-control";
import { DemoSuccessDialog } from "./demo-success-dialog";

type DemoEnquiryProps = {
  businessName: string;
  buttonLabel: string;
  fields: readonly DemoField[];
  formClassName?: string;
  successTitle: string;
  successMessage: string;
};

export function DemoEnquiry({
  businessName,
  buttonLabel,
  fields,
  formClassName,
  successTitle,
  successMessage,
}: DemoEnquiryProps) {
  const [isComplete, setIsComplete] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isComplete) return;
    closeButtonRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsComplete(false);
      window.requestAnimationFrame(() => submitButtonRef.current?.focus());
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isComplete]);

  function closeDialog() {
    setIsComplete(false);
    window.requestAnimationFrame(() => submitButtonRef.current?.focus());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsComplete(true);
  }

  return (
    <>
      <form
        className={formClassName}
        data-demo-form={businessName}
        onSubmit={handleSubmit}
      >
        <p className="mb-6 inline-flex rounded-full border border-current/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] opacity-65">
          Demonstration only · no details are sent
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map((field, index) => (
            <DemoFieldControl
              field={field}
              key={field.id}
              prominent={index === 0}
            />
          ))}
        </div>
        <button
          className="mt-6 min-h-12 w-full rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
          ref={submitButtonRef}
          type="submit"
        >
          {buttonLabel}
        </button>
      </form>

      {isComplete ? (
        <DemoSuccessDialog
          businessName={businessName}
          closeButtonRef={closeButtonRef}
          onClose={closeDialog}
          successMessage={successMessage}
          successTitle={successTitle}
        />
      ) : null}
    </>
  );
}
