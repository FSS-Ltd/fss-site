export const PREVIEW_EVENT_NAME = "fss:preview-event";

export type PreviewEventName =
  | "preview_viewed"
  | "owner_cta_clicked"
  | "mot_form_started"
  | "mot_form_completed"
  | "quote_form_started"
  | "quote_form_completed";

export type PreviewEvent = {
  prospectSlug: string;
  event: PreviewEventName;
};

export function trackPreviewEvent(event: PreviewEvent): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(PREVIEW_EVENT_NAME, { detail: event }));

  const gtag = Reflect.get(window, "gtag");
  if (typeof gtag === "function") {
    Reflect.apply(gtag, window, [
      "event",
      event.event,
      { prospect_slug: event.prospectSlug },
    ]);
  }
}
