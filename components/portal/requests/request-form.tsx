"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PortalButton, PortalCard, PortalSelect } from "@/components/portal/ui";
import { createRequestSchema } from "@/lib/operations/requests/validation";
import { postRequestCommand, type CreateRequestAction } from "./actions";
import { RequestField } from "./form-field";
import { requestHref } from "./presentation";
import styles from "./requests.module.css";

const requestTypes = ["work", "change", "bug", "help"] as const;
type RequestType = (typeof requestTypes)[number];

const requestTypeLabels: Record<RequestType, string> = {
  bug: "Bug report",
  change: "Change",
  help: "Help",
  work: "New work",
};

export function RequestForm({
  organisationId,
  projects,
  createAction,
  initialProjectId,
  initialType = "work",
}: {
  organisationId: string;
  projects: Array<{ id: string; title: string }>;
  createAction?: CreateRequestAction;
  initialProjectId?: string;
  initialType?: RequestType;
}): React.JSX.Element {
  const router = useRouter();
  const key = useRef<string | null>(null);
  const submitting = useRef(false);
  const [type, setType] = useState<RequestType>(initialType);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    key.current ??= crypto.randomUUID();
    const reproductionSteps = data.get("reproductionSteps");
    const expectedBehaviour = data.get("expectedBehaviour");
    const actualBehaviour = data.get("actualBehaviour");
    const input = createRequestSchema.safeParse({
      projectId: data.get("projectId"),
      title: data.get("title"),
      description: type === "bug" ? actualBehaviour : data.get("description"),
      type,
      desiredOutcome:
        type === "bug" ? expectedBehaviour : data.get("desiredOutcome"),
      desiredDate: data.get("desiredDate") || null,
      impact: data.get("impact"),
      idempotencyKey: key.current,
      ...(type === "bug"
        ? {
            reproductionSteps,
            expectedBehaviour,
            actualBehaviour,
          }
        : {}),
    });
    if (!input.success) {
      const fields = Object.fromEntries(
        input.error.issues.map((issue) => [
          String(issue.path[0]),
          issue.message,
        ]),
      );
      setErrors(fields);
      setMessage("Check the marked fields before sending your request.");
      const first = form.elements.namedItem(
        String(input.error.issues[0]?.path[0]),
      );
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    setErrors({});
    setMessage("");
    try {
      const result = await (createAction
        ? createAction(input.data)
        : postRequestCommand(
            "/api/portal/requests",
            organisationId,
            input.data,
          ));
      if (!result.ok) {
        setMessage(result.error);
        setErrors(result.fields ?? {});
        return;
      }
      setMessage("Request received. Opening its details…");
      router.push(requestHref(result.request.id, organisationId));
      router.refresh();
    } catch {
      setMessage(
        "We could not save your request. Your draft is still here. Try again.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  if (!projects.length)
    return (
      <section
        className={styles.noProject}
        aria-labelledby="no-project-heading"
      >
        <p className={styles.eyebrow}>Project setup</p>
        <h2 className={styles.sectionTitle} id="no-project-heading">
          A project is needed for this request.
        </h2>
        <p className={styles.copy}>
          Ask FSS to connect the right project to your workspace. Your account
          does not currently have access to one.
        </p>
        <Link
          className={styles.primary}
          href={`/help?organisationId=${encodeURIComponent(organisationId)}`}
        >
          Ask FSS to set up your project
        </Link>
      </section>
    );

  return (
    <form onSubmit={submit} className={styles.form} aria-busy={pending}>
      <fieldset className={styles.fieldset} disabled={pending}>
        <legend className={styles.sectionTitle}>Request type</legend>
        <div className={styles.typeSelector} aria-label="Request type">
          {requestTypes.map((requestType) => (
            <PortalButton
              key={requestType}
              onClick={() => setType(requestType)}
              type="button"
              variant={type === requestType ? "primary" : "secondary"}
            >
              {requestTypeLabels[requestType]}
            </PortalButton>
          ))}
        </div>

        <PortalCard title={type === "bug" ? "The problem" : "Your request"}>
          <PortalSelect
            defaultValue={
              projects.some((project) => project.id === initialProjectId)
                ? initialProjectId
                : projects.length === 1
                  ? projects[0].id
                  : ""
            }
            error={errors.projectId}
            hint="Only projects you can access appear here."
            label="Project"
            name="projectId"
            required
          >
            <option disabled value="">
              Choose a project
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </PortalSelect>
          <RequestField
            error={errors.title}
            label={type === "bug" ? "Short title" : "Request title"}
            maxLength={160}
            name="title"
            required
          />
          {type === "bug" ? (
            <>
              <RequestField
                error={errors.reproductionSteps}
                label="Steps to reproduce"
                maxLength={4000}
                multiline
                name="reproductionSteps"
                required
              />
              <RequestField
                error={errors.expectedBehaviour}
                label="What you expected"
                maxLength={4000}
                multiline
                name="expectedBehaviour"
                required
              />
              <RequestField
                error={errors.actualBehaviour}
                label="What happened instead"
                maxLength={4000}
                multiline
                name="actualBehaviour"
                required
              />
            </>
          ) : (
            <>
              <RequestField
                error={errors.description}
                label="Description"
                maxLength={10000}
                multiline
                name="description"
                required
              />
              <RequestField
                error={errors.desiredOutcome}
                hint="What will a successful result let you do?"
                label="What does success look like?"
                maxLength={4000}
                multiline
                name="desiredOutcome"
                required
              />
            </>
          )}
        </PortalCard>

        {type === "bug" ? (
          <PortalCard title="Impact & environment">
            <RequestField
              error={errors.impact}
              label="Impact"
              maxLength={4000}
              multiline
              name="impact"
            />
            <p className={styles.note}>
              Include the page address and browser/device in the description if
              they will help FSS reproduce the issue.
            </p>
          </PortalCard>
        ) : (
          <PortalCard title="Useful context">
            <RequestField
              error={errors.desiredDate}
              hint="A requested date is not yet an agreed delivery date."
              label="Desired date"
              name="desiredDate"
              type="date"
            />
            <RequestField
              error={errors.impact}
              label="Impact"
              maxLength={4000}
              multiline
              name="impact"
            />
          </PortalCard>
        )}

        <PortalCard
          description="Add a screenshot or document once secure uploads are enabled. Do not paste passwords, API keys or other credentials. Use your agreed secure sharing route for credentials."
          title="Attachments"
          tone="accent"
        >
          <span className={styles.visuallyHidden}>
            File uploads are not available yet.
          </span>
        </PortalCard>

        <PortalButton loading={pending} type="submit">
          Submit request
        </PortalButton>
      </fieldset>
      <p role="status" aria-atomic="true" className={styles.feedback}>
        {message}
      </p>
    </form>
  );
}
