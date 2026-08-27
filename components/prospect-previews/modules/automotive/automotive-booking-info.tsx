import { Clock3, MapPin, Phone, ShieldCheck, Star } from "lucide-react";

import type { AutomotiveProspectPreview } from "@/lib/prospect-previews/types";

type AutomotiveBookingInfoProps = {
  preview: AutomotiveProspectPreview;
};

export function AutomotiveBookingInfo({ preview }: AutomotiveBookingInfoProps) {
  return (
    <div className="grid gap-5">
      <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-6 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
          Workshop services
        </p>
        <ul className="mt-5 grid gap-3">
          {preview.research.services.map((service) => (
            <li
              className="flex items-center gap-3 text-sm font-semibold text-slate-800"
              key={service}
            >
              <span className="grid size-7 place-items-center rounded-full bg-orange-200 text-orange-900">
                <ShieldCheck aria-hidden="true" className="size-4" />
              </span>
              {service}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-7">
        <div className="flex items-center gap-2 text-amber-500">
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              aria-hidden="true"
              className="size-4 fill-current"
              key={index}
            />
          ))}
          <span className="ml-1 text-sm font-bold text-slate-900">
            {preview.research.rating} from {preview.research.reviewCount}{" "}
            reviews
          </span>
        </div>
        <blockquote className="mt-5 text-lg font-medium leading-8 text-slate-800">
          “{preview.content.reviews[0]?.quote}”
        </blockquote>
        <p className="mt-3 text-sm text-slate-500">
          {preview.content.reviews[0]?.author}
        </p>
      </div>

      <div className="rounded-[2rem] bg-slate-100 p-6 sm:p-7">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Clock3 aria-hidden="true" className="size-5 text-orange-600" />
          Opening hours
        </h3>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
          {preview.content.openingHours.map((hours) => (
            <li key={hours}>{hours}</li>
          ))}
        </ul>
        <div className="mt-5 border-t border-slate-200 pt-5 text-sm">
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <MapPin aria-hidden="true" className="size-4 text-orange-600" />
            {preview.location}
          </p>
          <a
            className="mt-3 inline-flex items-center gap-2 font-bold text-slate-900 underline decoration-orange-300 decoration-2 underline-offset-4"
            href={`tel:${preview.phone.replace(/\s/g, "")}`}
          >
            <Phone aria-hidden="true" className="size-4" />
            {preview.phone}
          </a>
        </div>
      </div>
    </div>
  );
}
