import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, BrainCircuit, Church, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { GlowCard } from "@/components/ui/spotlight-card";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

type Service = {
  number: string;
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
  tags: string[];
  tagColor: string;
  span: string;
  href?: string;
  ctaLabel?: string;
};

const services: Service[] = [
  {
    number: "01",
    icon: BarChart3,
    iconColor: "text-brand-primary",
    title: "Business Solutions",
    description:
      "Scalable ERP systems and custom CRM architectures designed to streamline operations and drive profitability.",
    tags: ["ERP", "CRM", "Supply Chain"],
    tagColor: "text-brand-primary",
    span: "md:col-span-3",
  },
  {
    number: "02",
    icon: BookOpen,
    iconColor: "text-[#b7c6f2]",
    title: "Education Systems",
    description:
      "Next-generation Learning Management Systems (LMS) that empower educators and engage students through data-driven insights.",
    tags: ["LMS", "Admin", "Analytics"],
    tagColor: "text-[#b7c6f2]",
    span: "md:col-span-3",
  },
  {
    number: "03",
    icon: BrainCircuit,
    iconColor: "text-brand-accent",
    title: "Local AI Readiness",
    description:
      "A practical route for deciding whether sensitive workflows should use local AI, cloud AI, or a hybrid model before data is exposed to the wrong tools.",
    tags: ["Private AI", "Workflow Audit", "Data Control"],
    tagColor: "text-brand-accent",
    span: "md:col-span-6",
    href: "/ai-deployment-questionnaire",
    ctaLabel: "Find out more",
  },
  {
    number: "04",
    icon: Church,
    iconColor: "text-[#b5c7e8]",
    title: "Religious Tech",
    description:
      "Integrated management systems focusing on community engagement and seamless donation tracking.",
    tags: [],
    tagColor: "",
    span: "md:col-span-2",
  },
  {
    number: "05",
    icon: Lightbulb,
    iconColor: "text-brand-accent",
    title: "Custom Organizational Apps",
    description:
      "Bespoke software tailored for specific non-profit and organizational workflows that standard off-the-shelf products can't solve.",
    tags: [],
    tagColor: "",
    span: "md:col-span-4",
  },
];

export function FeatureGridSection() {
  return (
    <Section id="services" className="pb-14 sm:pb-16">
      <SectionHeading
        eyebrow="What We Build"
        title="Strategic Solutions"
        description="Engineering clarity out of complexity for every sector we serve."
      />
      <div className="mt-11 grid grid-cols-1 gap-5 md:grid-cols-6">
        {services.map((service) => (
          <GlowCard
            key={service.title}
            customSize
            className={`${service.span} group p-8`}
          >
            <div className="mb-6 flex items-start justify-between">
              <service.icon className={`size-8 ${service.iconColor}`} aria-hidden="true" />
              <span className="font-extrabold text-lg text-border-strong">{service.number}</span>
            </div>
            <h3 className="mb-3 text-xl font-bold text-foreground">{service.title}</h3>
            <p className="text-sm leading-relaxed text-text-muted">{service.description}</p>
            {service.href && service.ctaLabel && (
              <Link
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-accent transition hover:text-brand-primary"
                href={service.href}
              >
                {service.ctaLabel}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
            {service.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {service.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${service.tagColor}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </GlowCard>
        ))}
      </div>
    </Section>
  );
}
