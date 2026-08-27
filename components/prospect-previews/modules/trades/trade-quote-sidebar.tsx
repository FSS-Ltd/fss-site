import { CircleAlert, Clock3, PhoneCall, ShieldCheck } from "lucide-react";

import type { TradeProspectPreview } from "@/lib/prospect-previews/types";

type TradeQuoteSidebarProps = {
  preview: TradeProspectPreview;
};

export function TradeQuoteSidebar({ preview }: TradeQuoteSidebarProps) {
  return (
    <aside className="grid content-start gap-5 rounded-[2rem] bg-cyan-950 p-6 text-white sm:p-8">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-300">
          Service area
        </p>
        <h3 className="mt-3 text-xl font-black">
          Local help, clearly qualified.
        </h3>
        <p className="mt-3 text-sm leading-6 text-cyan-100">
          {preview.content.serviceArea}
        </p>
      </div>

      <div className="rounded-2xl bg-lime-300 p-5 text-cyan-950">
        <div className="flex items-center gap-3">
          <CircleAlert aria-hidden="true" className="size-5" />
          <h3 className="font-black">Need urgent help?</h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-cyan-900/80">
          {preview.content.responsePromise}
        </p>
        <a
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-cyan-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-950"
          href={`tel:${preview.phone.replace(/\s/g, "")}`}
        >
          <PhoneCall aria-hidden="true" className="size-4" />
          Call {preview.phone}
        </a>
      </div>

      <div className="border-t border-white/10 pt-5">
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          <Clock3 aria-hidden="true" className="size-4 text-lime-300" />A better
          request begins with three facts
        </p>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-cyan-100">
          <li className="flex gap-3">
            <ShieldCheck
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-lime-300"
            />
            What has gone wrong
          </li>
          <li className="flex gap-3">
            <ShieldCheck
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-lime-300"
            />
            Where the property is
          </li>
          <li className="flex gap-3">
            <ShieldCheck
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-lime-300"
            />
            How quickly help is needed
          </li>
        </ul>
      </div>
    </aside>
  );
}
