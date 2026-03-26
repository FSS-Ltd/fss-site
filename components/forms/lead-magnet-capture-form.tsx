"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
  resourceSlug: string;
  ctaLabel?: string;
  redirectPath?: string;
  submitter?: (payload: LeadCapturePayload) => Promise<LeadCaptureResult>;
};

export function LeadMagnetCaptureForm({
  resourceSlug,
  ctaLabel = "Get resource",
  redirectPath,
  submitter = submitLeadCapture,
}: LeadMagnetCaptureFormProps) {
  const router = useRouter();

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
    const result = await submitter({
      ...values,
      challenge: values.challenge?.trim() || undefined,
      resourceSlug,
    });

    if (!result.ok) {
      return;
    }

    if (redirectPath) {
      router.push(redirectPath);
      return;
    }

    reset();
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
      <Button className="mt-2 w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : ctaLabel}
      </Button>
      {!redirectPath && isSubmitSuccessful ? (
        <p className="text-sm text-brand-primary">Thanks, your request has been received.</p>
      ) : null}
    </form>
  );
}
