type ChangeSubscription = {
  surface: EventTarget;
  visibilitySurface?: EventTarget;
  visible: () => boolean;
  refresh: () => void;
  openChannel: (
    receive: (event: MessageEvent) => void,
  ) => { close: () => void } | null;
};
export function subscribeCrmChanges({
  surface,
  visibilitySurface = surface,
  visible,
  refresh,
  openChannel,
}: ChangeSubscription): () => void {
  const seen = new Set<string>();
  let channel: { close: () => void } | null = null;
  const reconcile = () => {
    if (visible()) {
      channel ??= openChannel(receive);
      refresh();
    }
  };
  const visibilityChanged = () => {
    if (!visible()) {
      channel?.close();
      channel = null;
      return;
    }
    reconcile();
  };
  const acceptChange = (data: unknown) => {
    if (
      !data ||
      typeof data !== "object" ||
      !("type" in data) ||
      data.type !== "committed" ||
      !("id" in data) ||
      typeof data.id !== "string" ||
      data.id.length > 100 ||
      seen.has(data.id)
    )
      return;
    seen.add(data.id);
    if (seen.size > 100) {
      const oldest = seen.values().next().value;
      if (oldest) seen.delete(oldest);
    }
    reconcile();
  };
  const receive = (event: MessageEvent) => acceptChange(event.data);
  const committed = (event: Event) => {
    if (event instanceof CustomEvent) acceptChange(event.detail);
    else reconcile();
  };
  channel = visible() ? openChannel(receive) : null;
  visibilitySurface.addEventListener("visibilitychange", visibilityChanged);
  surface.addEventListener("focus", reconcile);
  surface.addEventListener("online", reconcile);
  surface.addEventListener("growth-crm-committed", committed);
  return () => {
    surface.removeEventListener("focus", reconcile);
    surface.removeEventListener("online", reconcile);
    surface.removeEventListener("growth-crm-committed", committed);
    visibilitySurface.removeEventListener(
      "visibilitychange",
      visibilityChanged,
    );
    channel?.close();
  };
}
export function publishCrmChange(): void {
  const change = { type: "committed", id: crypto.randomUUID() };
  window.dispatchEvent(
    new CustomEvent("growth-crm-committed", { detail: change }),
  );
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel("growth-crm");
    channel.postMessage(change);
    channel.close();
  } catch {
    /* Focus and online reconciliation remain available when channels are disabled. */
  }
}
