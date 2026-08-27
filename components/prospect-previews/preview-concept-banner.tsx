type PreviewConceptBannerProps = {
  businessName: string;
};

export function PreviewConceptBanner({
  businessName,
}: PreviewConceptBannerProps) {
  return (
    <aside
      aria-label="Preview concept information"
      className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs font-medium sm:px-8"
    >
      <p className="text-current/70">
        Concept prepared for {businessName} by Faithful Software Solutions
      </p>
      <details className="relative text-current">
        <summary className="cursor-pointer font-semibold underline decoration-current/30 underline-offset-4 outline-offset-4">
          What is this?
        </summary>
        <p className="absolute right-0 z-20 mt-3 w-72 rounded-xl bg-white p-4 text-sm leading-6 text-slate-700 shadow-xl ring-1 ring-slate-900/10">
          This concept uses publicly available business information to show how
          an improved customer journey could work. It is not currently connected
          to the business&apos;s live systems.
        </p>
      </details>
    </aside>
  );
}
