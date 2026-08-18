"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/forms/form-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import {
  leadMagnetCaptureSchema,
  submitLeadCapture,
  type LeadCapturePayload,
  type LeadCaptureResult,
  type LeadMagnetCaptureValues,
} from "@/lib/forms/lead-capture";

type LeadMagnetCaptureFormProps = {
  resourceSlug?: string;
  sourceContext: string;
  ctaLabel?: string;
  redirectPath?: string;
  submitter?: (payload: LeadCapturePayload) => Promise<LeadCaptureResult>;
};

export function LeadMagnetCaptureForm({
  resourceSlug,
  sourceContext,
  ctaLabel = "Get resource",
  redirectPath,
  submitter = submitLeadCapture,
}: LeadMagnetCaptureFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);

  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<LeadMagnetCaptureValues>({
    resolver: zodResolver(leadMagnetCaptureSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      workEmail: "",
      company: "",
      challenge: "",
    },
  });

  const onSubmit = async (values: LeadMagnetCaptureValues) => {
    setSubmitError(null);

    const result = await submitter({
      ...values,
      challenge: values.challenge?.trim() || undefined,
      sourceContext,
      sourcePath: pathname || "/",
      resourceSlug,
      submissionId: crypto.randomUUID(),
      newsletterOptIn,
    });

    if (!result.ok) {
      setSubmitError(result.errorMessage ?? "Something went wrong. Please try again.");
      return;
    }

    if (redirectPath) {
      router.push(redirectPath);
      return;
    }

    reset();
    setNewsletterOptIn(false);
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="firstName"
          label="First name"
          placeholder="Ada"
          autoComplete="given-name"
          error={errors.firstName?.message}
          {...register("firstName")}
        />
        <FormField
          id="lastName"
          label="Last name"
          placeholder="Lovelace"
          autoComplete="family-name"
          error={errors.lastName?.message}
          {...register("lastName")}
        />
      </div>
      <FormField
        id="workEmail"
        label="Work email"
        placeholder="ada@company.com"
        autoComplete="email"
        error={errors.workEmail?.message}
        {...register("workEmail")}
      />
      <FormField
        id="company"
        label="Company"
        placeholder="FSS"
        autoComplete="organization"
        error={errors.company?.message}
        {...register("company")}
      />
      <TextareaField
        id="challenge"
        label="Current challenge (optional)"
        placeholder="Tell us about your integration goals or blockers"
        error={errors.challenge?.message}
        {...register("challenge")}
      />
      <label className="flex items-start gap-2 text-sm text-foreground" htmlFor="newsletterOptIn">
        <input
          id="newsletterOptIn"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-border-soft"
          checked={newsletterOptIn}
          onChange={(event) => setNewsletterOptIn(event.target.checked)}
        />
        <span>Send me occasional practical notes from FSS Field Notes.</span>
      </label>
      <Button className="mt-2 w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : ctaLabel}
      </Button>
      {submitError ? <p className="text-sm text-rose-300">{submitError}</p> : null}
      {!redirectPath && isSubmitSuccessful ? (
        <p className="text-sm text-brand-primary">Thanks, your request has been received.</p>
      ) : null}
    </form>
  );
}
