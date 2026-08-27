"use client";

import { trackPreviewEvent } from "@/lib/prospect-previews/analytics";
import type { OwnerCta } from "@/lib/prospect-previews/types";

type PreviewOwnerCtaProps = {
  ownerCta: OwnerCta;
  prospectSlug: string;
};

export function PreviewOwnerCta({
  ownerCta,
  prospectSlug,
}: PreviewOwnerCtaProps) {
  return (
    <section className="rounded-2xl border border-current/15 bg-white/60 p-6 shadow-sm backdrop-blur sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-current/60">
        For the business owner
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">
        {ownerCta.title}
      </h2>
      <p className="mt-3 max-w-xl leading-7 text-current/70">
        {ownerCta.description}
      </p>
      <a
        className="mt-5 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        href={ownerCta.href}
        onClick={() =>
          trackPreviewEvent({ prospectSlug, event: "owner_cta_clicked" })
        }
      >
        {ownerCta.label}
      </a>
    </section>
  );
}
