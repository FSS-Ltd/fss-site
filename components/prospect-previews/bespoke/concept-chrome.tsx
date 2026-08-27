import { PreviewConceptBanner } from "../preview-concept-banner";

export function ConceptBar({ businessName }: { businessName: string }) {
  return <PreviewConceptBanner businessName={businessName} />;
}

export function OwnerInvitation({ businessName }: { businessName: string }) {
  return (
    <aside className="mx-auto my-14 w-[calc(100%-2.5rem)] max-w-6xl rounded-[2rem] border border-current/15 bg-white/75 p-7 text-slate-950 shadow-sm backdrop-blur sm:my-20 sm:p-10">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        For the business owner
      </p>
      <div className="mt-3 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            Built around {businessName}, ready to refine with you.
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            The visuals and customer journey are a working concept. FSS can
            tailor the detail, connect the workflow and prepare a launch version
            after your approval.
          </p>
        </div>
        <a
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
          href="mailto:hello@faithfulsoftware.dev"
        >
          Discuss this concept
        </a>
      </div>
    </aside>
  );
}
