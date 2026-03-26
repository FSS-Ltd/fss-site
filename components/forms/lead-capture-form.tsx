"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms/form-field";

const leadCaptureSchema = z.object({
  name: z.string().min(2, "Please enter your full name."),
  workEmail: z.email("Please enter a valid work email."),
  company: z.string().min(2, "Please enter your company name."),
});

type LeadCaptureValues = z.infer<typeof leadCaptureSchema>;

type LeadCaptureFormProps = {
  ctaLabel?: string;
};

export function LeadCaptureForm({ ctaLabel = "Request demo" }: LeadCaptureFormProps) {
  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<LeadCaptureValues>({
    resolver: zodResolver(leadCaptureSchema),
    defaultValues: {
      name: "",
      workEmail: "",
      company: "",
    },
  });

  const onSubmit = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    reset();
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <FormField
        id="name"
        label="Full name"
        placeholder="Ada Lovelace"
        autoComplete="name"
        error={errors.name?.message}
        {...register("name")}
      />
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
      <Button className="mt-2 w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : ctaLabel}
      </Button>
      {isSubmitSuccessful ? (
        <p className="text-sm text-brand-primary">Thanks, we will follow up shortly.</p>
      ) : null}
    </form>
  );
}
