"use client";

import Link from "next/link";
import {
  type MouseEvent,
  type ReactNode,
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
  isChipClickGuarded,
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

const stepNames = [
  "The work",
  "Your tools",
  "Your team",
  "Timing",
  "Last step",
];

/** Keep the whole card (question, choices, message and buttons) on screen. */
function revealCard(card: HTMLElement | null) {
  if (!card) return;
  const { top, bottom } = card.getBoundingClientRect();
  if (top >= 72 && bottom <= window.innerHeight) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  card.scrollIntoView({
    block: "start",
    behavior: reduce.matches ? "auto" : "smooth",
  });
}

function AnswerRow({
  label,
  value,
  current,
}: {
  label: string;
  value: string;
  current: boolean;
}) {
  return (
    <div className={styles.answer} data-current={current || undefined}>
      <dt>{label}</dt>
      <dd key={value || "empty"} data-empty={!value || undefined}>
        {value || (current ? "Answering now" : "Not answered yet")}
      </dd>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.chipIcon}>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

function Chip({
  label,
  pressed,
  multi = false,
  onClick,
}: {
  label: string;
  pressed: boolean;
  multi?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={pressed}
      data-multi={multi || undefined}
      onClick={onClick}
    >
      {pressed ? (
        <Check />
      ) : (
        multi && (
          <span aria-hidden="true" className={styles.chipPlus}>
            +
          </span>
        )
      )}
      {label}
    </button>
  );
}

export function ContactForm({ aside }: { aside?: ReactNode }) {
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
  const formElement = useRef<HTMLFormElement>(null);
  const previousStep = useRef(flow.step);
  const stepChangedAt = useRef(0);
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
  // Remember which way the last step change went so the entrance can follow it.
  const [shown, setShown] = useState({ step, direction: "forward" });
  if (shown.step !== step) {
    setShown({ step, direction: step > shown.step ? "forward" : "back" });
    setState("idle");
  }
  const detailLimit = contactDetailLimit();

  useEffect(() => {
    if (state === "success") successHeading.current?.focus();
  }, [state]);

  useEffect(() => {
    if (previousStep.current !== step) {
      stepChangedAt.current = performance.now();
      questionHeading.current?.focus({ preventScroll: true });
      revealCard(formElement.current);
    }
    previousStep.current = step;
  }, [step]);

  useEffect(() => {
    if (error) revealCard(formElement.current);
  }, [error]);

  const choose = (action: Parameters<typeof dispatch>[0]) => {
    submissionId.current = null;
    dispatch(action);
  };

  // Pointer clicks (detail > 0) just after a step change are a double-click tail; keyboard clicks pass.
  const pick =
    (action: Parameters<typeof dispatch>[0]) =>
    (event: MouseEvent<HTMLButtonElement>) => {
      if (
        event.detail > 0 &&
        isChipClickGuarded(stepChangedAt.current, performance.now())
      )
        return;
      choose(action);
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
          setError(field, {
            // The shared schema says "company"; this form's label says organisation.
            message:
              field === "company"
                ? "Please enter your organisation."
                : issue.message,
          });
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

  const successCard = (
    <section className={styles.success} role="status">
      <span className={styles.successMark} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M6 12.5l4 4 8-9" />
        </svg>
      </span>
      <h2 ref={successHeading} tabIndex={-1}>
        Your enquiry has been received
      </h2>
      <p>
        Thank you. We will review what you have shared and reply to your email
        about the next step.
      </p>
      <dl className={styles.summary}>
        <div>
          <dt>The work</dt>
          <dd>{answers.need}</dd>
        </div>
        {answers.tools.length > 0 && (
          <div>
            <dt>Tools</dt>
            <dd>{answers.tools.join(", ")}</dd>
          </div>
        )}
        <div>
          <dt>Team</dt>
          <dd>{answers.teamSize}</dd>
        </div>
        <div>
          <dt>Timing</dt>
          <dd>{answers.timing}</dd>
        </div>
      </dl>
      <p className={styles.hint}>No call has been booked.</p>
    </section>
  );

  const isLast = step === contactLastStep;
  const trail = [
    answers.need,
    answers.tools.join(", "),
    answers.teamSize,
    answers.timing,
  ]
    .filter(Boolean)
    .join(" · ");

  const formCard = (
    <form
      ref={formElement}
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
        <div className={styles.progressMeta}>
          <p className={styles.stepLabel}>
            Step {step + 1} of {contactStepCount}
          </p>
          <p className={styles.stepName} data-last={isLast || undefined}>
            {stepNames[step]}
          </p>
        </div>
        <StepProgress
          current={step + 1}
          total={contactStepCount}
          label="Enquiry progress"
        />
        {trail && <p className={styles.trail}>{trail}</p>}
      </div>
      <fieldset disabled={!hydrated || isSubmitting} className={styles.fields}>
        <legend className="sr-only">Your project and contact details</legend>
        <div
          className={styles.stepBody}
          key={step}
          data-direction={shown.direction}
        >
          <h2 className={styles.question} ref={questionHeading} tabIndex={-1}>
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
                    onClick={pick({ type: "choose-need", value: need })}
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
                    multi
                    pressed={answers.tools.includes(tool)}
                    onClick={pick({ type: "toggle-tool", value: tool })}
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
                  onClick={pick({ type: "choose-team", value: size })}
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
                  onClick={pick({ type: "choose-timing", value: timing })}
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
              <div className={styles.rowWide}>
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
              </div>
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
                Sending this does not book a call or commit you to a project. We
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
            <span aria-hidden="true" className={styles.errorIcon}>
              !
            </span>
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
              <span aria-hidden="true" className={styles.backArrow}>
                ←
              </span>
              Back
            </button>
          ) : (
            <span />
          )}
          {isLast ? (
            <Button
              size="lg"
              className={`min-h-12 ${styles.next}`}
              type="submit"
              magnetic
              disabled={!hydrated || isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send project enquiry"}
            </Button>
          ) : (
            <Button
              size="lg"
              className={`min-h-12 ${styles.next}`}
              type="submit"
            >
              {step === 1 && answers.tools.length === 0 ? "Skip" : "Continue"}
              <span aria-hidden="true" className={styles.nextArrow}>
                →
              </span>
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

  const tools =
    answers.tools.length > 0
      ? answers.tools.join(", ")
      : step > 1
        ? "None selected"
        : "";

  return (
    <>
      {state === "success" ? successCard : formCard}
      <aside
        className={styles.aside}
        aria-label="Your answers and what happens next"
        data-motion-reveal="right"
      >
        {state !== "success" && (
          <section className={styles.answers} aria-labelledby="contact-answers">
            <h2 id="contact-answers" className={styles.answersTitle}>
              Your answers so far
            </h2>
            <dl>
              <AnswerRow
                label="The work"
                value={answers.need}
                current={step === 0}
              />
              <AnswerRow label="Tools" value={tools} current={step === 1} />
              <AnswerRow
                label="Team"
                value={answers.teamSize}
                current={step === 2}
              />
              <AnswerRow
                label="Timing"
                value={answers.timing}
                current={step === 3}
              />
            </dl>
          </section>
        )}
        {aside}
      </aside>
    </>
  );
}
