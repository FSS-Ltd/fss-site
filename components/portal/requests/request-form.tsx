"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createRequestSchema } from "@/lib/operations/requests/validation";
import { postRequestCommand, type CreateRequestAction } from "./actions";
import { RequestField } from "./form-field";
import { requestHref } from "./presentation";
import styles from "./requests.module.css";

export function RequestForm({
  organisationId,
  projects,
  createAction,
}: {
  organisationId: string;
  projects: Array<{ id: string; title: string }>;
  createAction?: CreateRequestAction;
}): React.JSX.Element {
  const router = useRouter();
  const key = useRef<string | null>(null);
  const submitting = useRef(false);
  const [type, setType] = useState("work");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    key.current ??= crypto.randomUUID();
    const input = createRequestSchema.safeParse({
      projectId: data.get("projectId"),
      title: data.get("title"),
      description: data.get("description"),
      type,
      desiredOutcome: data.get("desiredOutcome"),
      desiredDate: data.get("desiredDate") || null,
      impact: data.get("impact"),
      idempotencyKey: key.current,
      ...(type === "bug"
        ? {
            reproductionSteps: data.get("reproductionSteps"),
            expectedBehaviour: data.get("expectedBehaviour"),
            actualBehaviour: data.get("actualBehaviour"),
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
      <p className={styles.empty}>
        A shared project is needed before you can create a request. Contact your
        FSS team to confirm the right project.
      </p>
    );
  return (
    <form onSubmit={submit} className={styles.form} aria-busy={pending}>
      <fieldset className={styles.fieldset} disabled={pending}>
        <legend className={styles.sectionTitle}>What do you need?</legend>
        <label className={styles.field}>
          Project
          <select
            name="projectId"
            required
            className={styles.input}
            defaultValue={projects.length === 1 ? projects[0].id : ""}
            aria-invalid={!!errors.projectId}
            aria-describedby={
              errors.projectId ? "request-project-error" : undefined
            }
          >
            <option value="" disabled>
              Choose a project
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
          {errors.projectId && (
            <span className={styles.errorText} id="request-project-error">
              {errors.projectId}
            </span>
          )}
        </label>
        <RequestField
          name="title"
          label="Request title"
          required
          maxLength={160}
          error={errors.title}
          hint="A short, specific description of the work."
        />
        <label className={styles.field}>
          Request type
          <select
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={styles.input}
          >
            <option value="work">New work</option>
            <option value="change">Change to existing work</option>
            <option value="bug">Something is not working</option>
            <option value="help">Help or advice</option>
          </select>
        </label>
        <RequestField
          name="description"
          label="Description"
          required
          multiline
          maxLength={10000}
          error={errors.description}
        />
        <RequestField
          name="desiredOutcome"
          label="Desired outcome"
          required
          multiline
          maxLength={4000}
          error={errors.desiredOutcome}
          hint="What will a successful result let you do?"
        />
        <div hidden={type !== "bug"} className={styles.form}>
          <RequestField
            name="reproductionSteps"
            label="Steps to reproduce"
            required={type === "bug"}
            multiline
            maxLength={4000}
            error={errors.reproductionSteps}
          />
          <RequestField
            name="expectedBehaviour"
            label="What you expected"
            required={type === "bug"}
            multiline
            maxLength={4000}
            error={errors.expectedBehaviour}
          />
          <RequestField
            name="actualBehaviour"
            label="What happened instead"
            required={type === "bug"}
            multiline
            maxLength={4000}
            error={errors.actualBehaviour}
          />
        </div>
        <div className={styles.notice}>
          <h2 className={styles.sectionTitle}>Timing and impact</h2>
          <p className={styles.copy}>
            A desired date helps us assess your request. We will confirm an
            agreed target after reviewing the scope.
          </p>
        </div>
        <RequestField
          name="desiredDate"
          label="Desired date"
          type="date"
          error={errors.desiredDate}
        />
        <RequestField
          name="impact"
          label="Impact on your work"
          multiline
          maxLength={4000}
          error={errors.impact}
        />
        <p className={styles.note}>
          Do not paste passwords, API keys or other credentials. File uploads
          are not available yet. Ask your FSS team for the agreed secure
          transfer method.
        </p>
        <button type="submit" className={styles.primary} disabled={pending}>
          {pending ? "Sending request…" : "Send request"}
        </button>
      </fieldset>
      <p role="status" aria-atomic="true" className={styles.feedback}>
        {message}
      </p>
    </form>
  );
}
