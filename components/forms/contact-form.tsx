"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { trackContactSuccess } from "@/lib/analytics/contact-events";
import {
  contactChallengeLimit,
  contactServices,
  prepareContactRequest,
  type ContactValues,
} from "@/lib/forms/contact-request";
import { submitLeadCapture } from "@/lib/forms/lead-capture";
import { ContactField } from "./contact-field";
import { Button } from "@/components/ui/button";
import styles from "./contact-form.module.css";

type SubmitState = "idle" | "offline" | "error" | "success";

const subscribeToHydration = () => () => {};

export function ContactForm() {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [state, setState] = useState<SubmitState>("idle");
  const submissionId = useRef<string | null>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    setFocus,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      workEmail: "",
      company: "",
      challenge: "",
      service: "Not sure yet",
      newsletterOptIn: false,
    },
  });
  const service = watch("service");
  const challenge = watch("challenge") ?? "";
  const challengeLimit = contactChallengeLimit(service);

  useEffect(() => {
    if (state === "success") successHeading.current?.focus();
  }, [state]);

  const onSubmit = async (values: ContactValues) => {
    clearErrors();
    setState("idle");
    submissionId.current ??= crypto.randomUUID();
    const result = prepareContactRequest(values, submissionId.current);
    if (!result.success) {
      const fields = [
        "firstName",
        "lastName",
        "workEmail",
        "company",
        "challenge",
      ] as const;
      let firstError: (typeof fields)[number] | undefined;
      for (const field of fields) {
        const issue = result.error.issues.find(
          (item) => item.path[0] === field,
        );
        if (issue) {
          setError(field, { message: issue.message });
          firstError ??= field;
        }
      }
      if (firstError) setFocus(firstError);
      return;
    }
    if (!navigator.onLine) {
      setState("offline");
      return;
    }
    const response = await submitLeadCapture(result.data);
    if (!response.ok) {
      setState(navigator.onLine ? "error" : "offline");
      return;
    }
    setState("success");
    trackContactSuccess();
  };

  if (state === "success") {
    return (
      <div className={styles.success} role="status">
        <h2 ref={successHeading} tabIndex={-1}>
          Your enquiry has been received
        </h2>
        <p>
          Thank you. We will review what you have shared and reply to your email
          about the next step.
        </p>
        <p>No call has been booked.</p>
      </div>
    );
  }

  return (
    <form
      method="post"
      className={styles.form}
      noValidate
      aria-label="Project enquiry"
      aria-busy={isSubmitting}
      onSubmit={handleSubmit(onSubmit)}
      onChangeCapture={() => {
        submissionId.current = null;
      }}
    >
      <fieldset disabled={!hydrated || isSubmitting} className={styles.fields}>
        <legend className="sr-only">Your project and contact details</legend>
        <div className={styles.row}>
          <ContactField
            label="First name"
            autoComplete="given-name"
            registration={register("firstName")}
            error={errors.firstName?.message}
          />
          <ContactField
            label="Last name"
            autoComplete="family-name"
            registration={register("lastName")}
            error={errors.lastName?.message}
          />
        </div>
        <ContactField
          label="Work email"
          type="email"
          autoComplete="email"
          registration={register("workEmail")}
          error={errors.workEmail?.message}
        />
        <ContactField
          label="Organisation"
          autoComplete="organization"
          registration={register("company")}
          error={errors.company?.message}
        />
        <fieldset className={styles.choices}>
          <legend>What do you need?</legend>
          <div className={styles.choiceList}>
            {contactServices.map((option, index) => (
              <label
                key={option}
                className={styles.choice}
                htmlFor={`contact-service-${index}`}
              >
                <input
                  {...register("service")}
                  id={`contact-service-${index}`}
                  type="radio"
                  value={option}
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
        <div className={styles.field}>
          <label htmlFor="contact-challenge">
            Project challenge (optional)
          </label>
          <textarea
            {...register("challenge")}
            id="contact-challenge"
            className={styles.input}
            rows={5}
            maxLength={challengeLimit}
            aria-invalid={Boolean(errors.challenge)}
            aria-describedby={`contact-challenge-hint${errors.challenge ? " contact-challenge-error" : ""}`}
          />
          <p className={styles.hint} id="contact-challenge-hint">
            {challenge.length}/{challengeLimit} characters. Please leave out
            confidential or sensitive personal information.
          </p>
          {errors.challenge && (
            <p id="contact-challenge-error" className={styles.error}>
              {errors.challenge.message}
            </p>
          )}
        </div>
        <label htmlFor="contact-newsletter" className={styles.consent}>
          <input
            {...register("newsletterOptIn")}
            type="checkbox"
            id="contact-newsletter"
          />
          <span>
            Send me occasional practical notes from FSS Field Notes (optional).
          </span>
        </label>
      </fieldset>
      <p className={styles.hint}>
        We use these details to respond to your enquiry. Read our{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          privacy notice
        </Link>
        .
      </p>
      {state === "offline" && (
        <p className={styles.status} role="alert">
          You are offline. Your details are still here. Reconnect, then send
          your enquiry again.
        </p>
      )}
      {state === "error" && (
        <p className={styles.status} role="alert">
          We could not send your enquiry. Your details are still here. Please
          try again, or email hello@faithfulsoftware.dev.
        </p>
      )}
      <Button
        size="lg"
        className="min-h-12"
        type="submit"
        disabled={!hydrated || isSubmitting}
      >
        {isSubmitting ? "Sending…" : "Send project enquiry"}
      </Button>
      <p role="status" aria-live="polite" className="sr-only">
        {isSubmitting ? "Sending your project enquiry." : ""}
      </p>
      <noscript>
        <p>
          Please enable JavaScript to send this form, or email
          hello@faithfulsoftware.dev with your project enquiry.
        </p>
      </noscript>
    </form>
  );
}
