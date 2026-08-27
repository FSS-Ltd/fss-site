export function CompositionOwnerCta({
  mode,
}: {
  mode: "public" | "review";
}) {
  return (
    <aside className="mt-10 rounded-[1.5rem] bg-[var(--preview-accent)] p-6 text-[var(--preview-accent-contrast)] sm:mt-16 sm:p-10">
      <h2 className="m-0 max-w-3xl text-[clamp(1.65rem,3vw,2.5rem)] font-semibold tracking-[-0.045em]">
        {mode === "review" ? "Private website concept" : "Built as a considered example"}
      </h2>
      <p className="mt-4 max-w-2xl leading-6">
        This concept demonstrates a clearer customer journey. It is not connected to a live service.
      </p>
    </aside>
  );
}
