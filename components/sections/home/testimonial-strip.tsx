import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

const caseStudies = [
  {
    category: "Business Solutions",
    categoryColor: "text-brand-primary",
    hoverBorder: "hover:border-brand-primary/20",
    title: "Enterprise ERP Overhaul",
    description:
      "How we streamlined supply chain logistics for a global manufacturing firm, reducing operational costs by 22%.",
  },
  {
    category: "Education Systems",
    categoryColor: "text-[#b7c6f2]",
    hoverBorder: "hover:border-[#b7c6f2]/20",
    title: "St. Jude's Academy LMS",
    description:
      "Implementing a bespoke portal for 1,200 students that unified grading, attendance, and remote learning.",
  },
  {
    category: "Religious Tech",
    categoryColor: "text-[#b5c7e8]",
    hoverBorder: "hover:border-[#b5c7e8]/20",
    title: "Grace Community Portal",
    description:
      "Modernizing member management and digital giving for a rapidly growing multi-site church congregation.",
  },
];

export function TestimonialStrip() {
  return (
    <Section id="case-studies" className="pt-14">
      <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          eyebrow="Case Studies"
          title="Proven Results"
          description="Real-world impact across diverse industries through custom engineering."
        />
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 shrink-0 text-sm font-bold text-brand-primary transition hover:text-foreground"
        >
          View All Case Studies <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {caseStudies.map((study) => (
          <article
            key={study.title}
            className={`group rounded-xl border border-border-soft/40 bg-surface-2 p-8 transition-all ${study.hoverBorder}`}
          >
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${study.categoryColor}`}>
              {study.category}
            </p>
            <h3 className="mt-3 text-xl font-bold text-foreground">{study.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">{study.description}</p>
            <Link
              href="/blog"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-foreground transition hover:text-brand-primary"
            >
              Read Case Study <ArrowRight className="size-4" />
            </Link>
          </article>
        ))}
      </div>
    </Section>
  );
}
