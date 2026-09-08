import type { JourneyJob, JourneyView } from "./command-types";
export function jobExplanation(job: JourneyJob, journey: JourneyView): string {
  if (job.providerId)
    return journey.state === "cancelled"
      ? "Accepted externally, including any call already in flight. Cancellation cannot unsend this effect."
      : "Accepted by the provider. This does not confirm delivery or reading.";
  if (job.uncertain)
    return "An earlier attempt may have been accepted. Verify the original provider record before recording acceptance. Do not send again to test it.";
  if (job.state === "cancelled")
    return "Remaining work cancelled. An already running provider call may still report acceptance.";
  if (job.failureCode)
    return `Needs review: ${job.failureCode.replaceAll("_", " ")}. The completed effects will be retained.`;
  if (
    job.step === "thank_you" &&
    journey.jobs.some(
      (j) =>
        ["invoice", "invitation"].includes(j.step) && j.state !== "succeeded",
    )
  )
    return "Waiting for the first invoice and all approved portal access. Invoice recovery reuses the same obligation.";
  if (
    job.step === "invitation" &&
    !journey.jobs.some((j) => j.step === "invoice" && j.state === "succeeded")
  )
    return "Waiting for the first invoice.";
  if (
    job.step === "activation" &&
    !journey.jobs.some(
      (j) =>
        j.step === "invitation" &&
        j.recipient === job.recipient &&
        j.state === "succeeded",
    )
  )
    return "Waiting for this recipient’s portal access.";
  if (
    job.step === "proposal" &&
    journey.jobs.some(
      (j) => j.step === "proposal_access" && j.state !== "succeeded",
    )
  )
    return "Waiting for all approved portal access before signing notices can be sent.";
  if (job.state === "leased")
    return "A worker holds this step. Pause or cancel prevents future calls, but cannot undo a call already in flight.";
  if (journey.state === "paused")
    return "Paused. Resume keeps completed effects and original provider keys.";
  return "Queued for its eligible time and required approvals.";
}
export function canReconcile(job: JourneyJob): boolean {
  return job.uncertain && !job.providerId;
}

export function canRetry(job: JourneyJob, journey: JourneyView): boolean {
  return (
    journey.state === "active" &&
    job.state === "held" &&
    !job.uncertain &&
    !job.providerId &&
    job.attempts < 6 &&
    ["transport", "rate_limited", "configuration", "invalid_contract"].includes(
      job.failureCode ?? "",
    )
  );
}
