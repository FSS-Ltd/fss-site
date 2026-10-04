"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
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
  variant?: "default" | "compact-download";
};

export function LeadMagnetCaptureForm({
  resourceSlug,
  sourceContext,
  ctaLabel = "Get resource",
  redirectPath,
  submitter = submitLeadCapture,
  variant = "default",
}: LeadMagnetCaptureFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const isCompactDownload = variant === "compact-download";

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
      setSubmitError(
        result.errorMessage ?? "Something went wrong. Please try again.",
      );
      return;
    }

    if (redirectPath) {
      router.push(redirectPath);
      return;
    }

    reset();
    setNewsletterOptIn(false);
  };

  const companyField = (
    <FormField
      id="company"
      label={isCompactDownload ? "Business name" : "Company"}
      placeholder={isCompactDownload ? "Your plumbing business" : "FSS"}
      autoComplete="organization"
      className={isCompactDownload ? "h-12 text-base" : undefined}
      error={errors.company?.message}
      {...register("company")}
    />
  );

  const emailField = (
    <FormField
      id="workEmail"
      label={isCompactDownload ? "Email" : "Work email"}
      placeholder={isCompactDownload ? "sam@example.com" : "ada@company.com"}
      type="email"
      autoComplete="email"
      className={isCompactDownload ? "h-12 text-base" : undefined}
      error={errors.workEmail?.message}
      {...register("workEmail")}
    />
  );

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="firstName"
          label="First name"
          placeholder={isCompactDownload ? "Sam" : "Ada"}
          autoComplete="given-name"
          className={isCompactDownload ? "h-12 text-base" : undefined}
          error={errors.firstName?.message}
          {...register("firstName")}
        />
        <FormField
          id="lastName"
          label="Last name"
          placeholder={isCompactDownload ? "Taylor" : "Lovelace"}
          autoComplete="family-name"
          className={isCompactDownload ? "h-12 text-base" : undefined}
          error={errors.lastName?.message}
          {...register("lastName")}
        />
      </div>
      {isCompactDownload ? companyField : emailField}
      {isCompactDownload ? emailField : companyField}
      {!isCompactDownload ? (
        <TextareaField
          id="challenge"
          label="Current challenge (optional)"
          placeholder="Tell us about your integration goals or blockers"
          error={errors.challenge?.message}
          {...register("challenge")}
        />
      ) : null}
      <label
        className="flex items-start gap-3 text-sm leading-6 text-foreground"
        htmlFor="newsletterOptIn"
      >
        <input
          id="newsletterOptIn"
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 rounded border-border-soft focus-visible:outline-2"
          style={{ accentColor: "var(--brand-primary)" }}
          checked={newsletterOptIn}
          onChange={(event) => setNewsletterOptIn(event.target.checked)}
        />
        <span>
          Send me occasional practical notes from FSS Field Notes
          {isCompactDownload ? " (optional)" : ""}.
        </span>
      </label>
      {isCompactDownload ? (
        <p className="text-xs leading-6 text-text-muted">
          Newsletter signup is optional. Unsubscribe anytime. Read our{" "}
          <Link
            href="/privacy"
            className="font-medium text-brand-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            privacy policy
          </Link>
          .
        </p>
      ) : null}
      <Button className="mt-2 w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : ctaLabel}
      </Button>
      {submitError ? (
        <p role="alert" className="text-sm text-red-700">
          {submitError}
        </p>
      ) : null}
      {!redirectPath && isSubmitSuccessful ? (
        <p role="status" className="text-sm text-brand-primary">
          Thanks, your request has been received.
        </p>
      ) : null}
    </form>
  );
}
