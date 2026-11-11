"use client";

import Link from "next/link";
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useForm } from "react-hook-form";
import { trackContactSuccess } from "@/lib/analytics/contact-events";
import {
  contactDetailLimit,
  contactNeeds,
  contactTeamSizes,
  contactTimings,
  contactTools,
  prepareContactRequest,
  type ContactValues,
} from "@/lib/forms/contact-request";
import {
  contactFlowReducer,
  contactLastStep,
  contactStepCount,
  initialContactFlow,
} from "@/lib/forms/contact-steps";
import { submitLeadCapture } from "@/lib/forms/lead-capture";
import { ContactField } from "./contact-field";
import { StepProgress } from "./step-progress";
import { Button } from "@/components/ui/button";
import styles from "./contact-form.module.css";

type SubmitState = "idle" | "offline" | "error" | "success";
type ContactDetails = Pick<
  ContactValues,
  "firstName" | "lastName" | "workEmail" | "company" | "newsletterOptIn"
>;

const subscribeToHydration = () => () => {};

const questions = [
  "What would you like to stop doing by hand, or have AI do?",
  "Which tools do you use today?",
  "How many people work there?",
  "When would you want it working?",
  "Where should we send our reply?",
];

function Chip({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function ContactForm() {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [state, setState] = useState<SubmitState>("idle");
  const [flow, dispatch] = useReducer(contactFlowReducer, initialContactFlow);
  const submissionId = useRef<string | null>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(flow.step);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ContactDetails>({
    defaultValues: {
      firstName: "",
      lastName: "",
      workEmail: "",
      company: "",
      newsletterOptIn: false,
    },
  });
  const { step, answers, error } = flow;
  const detailLimit = contactDetailLimit(answers);

  useEffect(() => {
    if (state === "success") successHeading.current?.focus();
  }, [state]);

  useEffect(() => {
    if (previousStep.current !== step) questionHeading.current?.focus();
    previousStep.current = step;
  }, [step]);

  const choose = (action: Parameters<typeof dispatch>[0]) => {
    submissionId.current = null;
    dispatch(action);
  };

  const onSubmit = async (details: ContactDetails) => {
    clearErrors();
    setState("idle");
    submissionId.current ??= crypto.randomUUID();
    const result = prepareContactRequest(
      { ...details, ...answers },
      submissionId.current,
    );
    if (!result.success) {
      const fields = ["firstName", "lastName", "workEmail", "company"] as const;
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

  const isLast = step === contactLastStep;

  return (
    <form
      method="post"
      className={styles.form}
      noValidate
      aria-label="Project enquiry"
      aria-busy={isSubmitting}
      onSubmit={(event) => {
        if (isLast) {
          void handleSubmit(onSubmit)(event);
        } else {
          event.preventDefault();
          choose({ type: "next" });
        }
      }}
      onChangeCapture={() => {
        submissionId.current = null;
      }}
    >
      <div className={styles.progress}>
        <p className={styles.stepLabel}>
          Step {step + 1} of {contactStepCount}
        </p>
        <StepProgress
          current={step + 1}
          total={contactStepCount}
          label="Enquiry progress"
        />
      </div>
      <fieldset disabled={!hydrated || isSubmitting} className={styles.fields}>
        <legend className="sr-only">Your project and contact details</legend>
        <div className={styles.stepBody} key={step}>
          <h2
            className={styles.question}
            ref={questionHeading}
            tabIndex={-1}
          >
            {questions[step]}
          </h2>

          {step === 0 && (
            <>
              <div
                className={styles.chips}
                role="group"
                aria-label="What you would like help with"
              >
                {contactNeeds.map((need) => (
                  <Chip
                    key={need}
                    label={need}
                    pressed={answers.need === need}
                    onClick={() => choose({ type: "choose-need", value: need })}
                  />
                ))}
              </div>
              <div className={styles.field}>
                <label htmlFor="contact-detail">
                  Anything we should know? (optional)
                </label>
                <input
                  id="contact-detail"
                  type="text"
                  className={styles.input}
                  value={answers.detail}
                  maxLength={detailLimit}
                  onChange={(event) =>
                    choose({ type: "set-detail", value: event.target.value })
                  }
                  aria-describedby="contact-detail-hint"
                />
                <p className={styles.hint} id="contact-detail-hint">
                  A line is plenty. Please leave out confidential or sensitive
                  personal information.
                </p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className={styles.hint}>Choose any that apply, or skip.</p>
              <div
                className={styles.chips}
                role="group"
                aria-label="Tools you use today"
              >
                {contactTools.map((tool) => (
                  <Chip
                    key={tool}
                    label={tool}
                    pressed={answers.tools.includes(tool)}
                    onClick={() => choose({ type: "toggle-tool", value: tool })}
                  />
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <div
              className={styles.chips}
              role="group"
              aria-label="Number of people"
            >
              {contactTeamSizes.map((size) => (
                <Chip
                  key={size}
                  label={size}
                  pressed={answers.teamSize === size}
                  onClick={() => choose({ type: "choose-team", value: size })}
                />
              ))}
            </div>
          )}

          {step === 3 && (
            <div
              className={styles.chips}
              role="group"
              aria-label="When you want it working"
            >
              {contactTimings.map((timing) => (
                <Chip
                  key={timing}
                  label={timing}
                  pressed={answers.timing === timing}
                  onClick={() =>
                    choose({ type: "choose-timing", value: timing })
                  }
                />
              ))}
            </div>
          )}

          {isLast && (
            <>
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
              <label htmlFor="contact-newsletter" className={styles.consent}>
                <input
                  {...register("newsletterOptIn")}
                  type="checkbox"
                  id="contact-newsletter"
                />
                <span>
                  Send me occasional practical notes from FSS Field Notes
                  (optional).
                </span>
              </label>
              <p className={styles.hint}>
                We will review your enquiry and reply about the next step.
                Sending it does not book a call or commit you to a project. We
                use these details to respond to your enquiry. Read our{" "}
                <Link href="/privacy" className="underline underline-offset-4">
                  privacy notice
                </Link>
                .
              </p>
            </>
          )}
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
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

        <div className={styles.nav}>
          {step > 0 ? (
            <button
              type="button"
              className={styles.back}
              onClick={() => choose({ type: "back" })}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {isLast ? (
            <Button
              size="lg"
              className="min-h-12"
              type="submit"
              magnetic
              disabled={!hydrated || isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send project enquiry"}
            </Button>
          ) : (
            <Button size="lg" className="min-h-12" type="submit">
              {step === 1 && answers.tools.length === 0 ? "Skip" : "Continue"}
            </Button>
          )}
        </div>
      </fieldset>
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
