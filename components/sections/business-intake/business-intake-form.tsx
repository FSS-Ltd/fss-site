"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, CheckCircle2, PartyPopper } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Path } from "react-hook-form";
import { useForm, useWatch } from "react-hook-form";

import { FormField } from "@/components/forms/form-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import {
  intakeSteps,
  intakeSubmissionSchema,
  type IntakeField,
  type IntakeSubmissionValues,
} from "@/lib/intake/schema";
import { submitIntake } from "@/lib/intake/submit";
import { cn } from "@/lib/utils/cn";

const defaultValues: Partial<IntakeSubmissionValues> = {
  firstName: "",
  email: "",
  businessName: "",
  ideaDescription: "",
  problem: "",
  targetCustomer: "",
  currentAlternatives: "",
  customerConversations: "",
  demandEvidenceDetail: "",
  goals6to12Months: "",
  successDefinition: "",
  audienceLocation: "",
  biggestObstacle: "",
  additionalNotes: "",
  botField: "",
};

function IntakeSelectField({
  field,
  value,
  error,
  onSelect,
}: {
  field: IntakeField;
  value: string | undefined;
  error?: string;
  onSelect: (optionId: string) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="block text-sm font-semibold text-foreground">{field.label}</legend>
      <div className="grid gap-3">
        {field.options?.map((option) => {
          const selected = value === option.id;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              className={cn(
                "group rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                selected
                  ? "border-brand-accent bg-brand-accent/10 text-foreground"
                  : "border-border-soft/80 bg-[#f7f8f9] text-text-muted hover:border-brand-accent/45 hover:bg-white",
              )}
              onClick={() => onSelect(option.id)}
            >
              <span className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-brand-accent bg-brand-accent text-[#fff]"
                      : "border-border-strong text-transparent group-hover:border-brand-accent",
                  )}
                  aria-hidden="true"
                >
                  <CheckCircle2 className="size-3.5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="mt-1 block text-sm leading-6 text-text-muted">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </fieldset>
  );
}

export function BusinessIntakeForm() {
  const pathname = usePathname();
  const [stepIndex, setStepIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<IntakeSubmissionValues>({
    resolver: zodResolver(intakeSubmissionSchema),
    defaultValues,
    mode: "onBlur",
  });

  const formValues = useWatch({ control });

  const step = intakeSteps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === intakeSteps.length - 1;
  const progressPercent = Math.round(((stepIndex + 1) / intakeSteps.length) * 100);

  const goNext = async () => {
    const fieldIds = step.fields.map((field) => field.id as Path<IntakeSubmissionValues>);
    const isStepValid = await trigger(fieldIds);

    if (isStepValid) {
      setStepIndex((current) => Math.min(current + 1, intakeSteps.length - 1));
    }
  };

  const goBack = () => {
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const onSubmit = async (values: IntakeSubmissionValues) => {
    setSubmitError(null);

    const result = await submitIntake({
      ...values,
      sourcePath: pathname || "/",
    });

    if (!result.ok) {
      setSubmitError(result.errorMessage ?? "Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div
        data-lift-light
        className="rounded-[22px] border border-border-soft/70 bg-white p-7 text-center shadow-[0_40px_90px_-55px_rgba(33,27,23,.45)] sm:p-10"
      >
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[rgba(20,152,158,.12)] text-[#0f7a83]">
          <PartyPopper className="size-5" aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-2xl font-semibold text-foreground">Thanks — we&apos;ve got it.</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-text-muted">
          We received your idea and will review it. If it makes sense to talk further,
          we&apos;ll be in touch at the email you shared.
        </p>
      </div>
    );
  }

  return (
    <div
      data-lift-light
      className="rounded-[22px] border border-border-soft/70 bg-white p-5 shadow-[0_40px_90px_-55px_rgba(33,27,23,.45)] sm:p-7"
    >
      <div className="flex flex-col gap-4 border-b border-border-soft/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-brand-primary">
            {step.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">{step.title}</h2>
          {step.description ? (
            <p className="mt-2 text-sm leading-6 text-text-muted">{step.description}</p>
          ) : null}
        </div>
        <p className="rounded-full border border-border-soft/80 bg-[#f7f8f9] px-4 py-2 text-sm whitespace-nowrap text-text-muted">
          Step {stepIndex + 1} of {intakeSteps.length}
        </p>
      </div>

      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-[#eef0f2]">
        <div
          className="h-full rounded-full bg-brand-accent transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <form
        className="mt-7 space-y-6"
        onSubmit={isLastStep ? handleSubmit(onSubmit) : (event) => event.preventDefault()}
      >
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
          {...register("botField")}
        />

        {step.fields.map((field) => {
          if (field.type === "select") {
            const value = formValues?.[field.id] as string | undefined;

            return (
              <IntakeSelectField
                key={field.id}
                field={field}
                value={value}
                error={errors[field.id]?.message as string | undefined}
                onSelect={(optionId) =>
                  setValue(field.id, optionId, {
                    shouldValidate: true,
                  } as never)
                }
              />
            );
          }

          if (field.type === "textarea") {
            return (
              <TextareaField
                key={field.id}
                id={field.id}
                label={field.label}
                placeholder={field.placeholder}
                error={errors[field.id]?.message as string | undefined}
                {...register(field.id)}
              />
            );
          }

          return (
            <FormField
              key={field.id}
              id={field.id}
              type={field.type}
              label={field.label}
              placeholder={field.placeholder}
              autoComplete={field.autoComplete}
              error={errors[field.id]?.message as string | undefined}
              {...register(field.id)}
            />
          );
        })}

        <div className="flex flex-col gap-3 border-t border-border-soft/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
          {isFirstStep ? (
            <span />
          ) : (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-text-muted transition hover:text-brand-primary"
              onClick={goBack}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
          )}

          {isLastStep ? (
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? "Submitting..." : "Submit my idea"}
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" className="gap-2" onClick={goNext}>
              Next <ArrowRight className="size-4" />
            </Button>
          )}
        </div>

        {submitError ? <p className="text-sm text-rose-500">{submitError}</p> : null}
      </form>
    </div>
  );
}
