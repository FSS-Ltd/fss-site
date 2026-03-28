import Image from "next/image";
import { GraduationCap, Wifi } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: GraduationCap,
    title: "Next-Gen Learning Platforms",
    description:
      "Tailored LMS portals with interactive grading, video delivery, and parent-teacher communication hubs.",
  },
  {
    icon: Wifi,
    title: "Campus Management Systems",
    description:
      "Secure student records, enrollment automation, and resource scheduling for K-12 and Higher Ed.",
  },
];

export function ServicesEducation() {
  return (
    <Section>
      <div className="grid gap-12 md:grid-cols-2 items-center">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-border-soft/40">
          <Image
            src="/images/illustrations/services-education.svg"
            alt="LMS portal dashboard illustration"
            fill
            className="object-cover"
          />
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Education &amp; LMS Infrastructure
          </h2>
          <p className="text-base leading-7 text-text-muted">
            We build the digital backbone for modern learning environments. Our solutions focus
            on engagement, accessibility, and administrative efficiency.
          </p>
          <div className="space-y-6">
            {features.map((feature) => (
              <div key={feature.title} className="flex gap-4">
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                  <feature.icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{feature.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-text-muted">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
          <ButtonLink href="/contact" variant="secondary">
            Request a Consultation
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
