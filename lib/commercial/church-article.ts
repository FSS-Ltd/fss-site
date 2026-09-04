import type { BlogPost } from "@/lib/types/blog";
import { guidePages } from "./guides";
import type { CommercialSection } from "./types";

const page = guidePages["/blog/church-management-software-vs-bespoke"];

// The public article and blog listings share the same supported comparison copy.
export const churchArticle: BlogPost = {
  meta: {
    slug: "church-management-software-vs-bespoke",
    title: page.heading,
    excerpt: page.description,
    publishDate: "2026-09-04",
    modifiedDate: page.modifiedDate,
    author: "Faithful Software Solutions Ltd",
    authorUrl: "https://faithfulsoftware.dev/about",
    audience: ["Church administrators", "Ministry leads", "Trustees"],
    summary: page.answer,
    sources: [
      {
        title: "NexSteps first-party product evidence",
        url: "https://faithfulsoftware.dev/work/nexsteps",
      },
    ],
    category: "Software decisions",
    tags: ["Charities", "Church software", "Custom Software"],
    coverImage: "/redesign/products/admin-dashboard.png",
    seoTitle: page.title,
    seoDescription: page.description,
    indexable: true,
    featured: true,
    readingMinutes: 4,
  },
  body: [
    ...page.sections.map(
      (section: CommercialSection) =>
        `## ${section.title}\n\n${section.text}\n\n${(section.points ?? []).map((point) => "- " + point).join("\n")}\n\n${(section.links ?? []).map((link) => `[${link.label}](${link.href})`).join("\n\n")}`,
    ),
    ...page.faqs.map((faq) => `## ${faq.question}\n\n${faq.answer}`),
  ].join("\n\n"),
};
