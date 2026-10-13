import { compileMDX } from "next-mdx-remote/rsc";
import { ArrowUpRight } from "lucide-react";

import { ResourceSchema } from "@/components/seo/resource-schema";
import type { ResourceItem } from "@/lib/types/resource";
import { GuideHero } from "./guide-hero";
import { GuidePreview } from "./guide-preview";
import { GuideDownload } from "./guide-download";
import styles from "./guide-page.module.css";

export async function AiReceptionistGuidePage({
  resource,
}: {
  resource: ResourceItem;
}) {
  const { content } = await compileMDX({ source: resource.body });

  return (
    <div className={styles.page}>
      <ResourceSchema resource={resource.meta} authorType="Person" />
      <GuideHero resource={resource.meta} />
      <div className={styles.facts} aria-label="Included in the free guide">
        <div>
          <span>28</span>
          <p>pages of practical guidance</p>
        </div>
        <div>
          <span>Copy & paste</span>
          <p>a two-part receptionist prompt</p>
        </div>
        <div>
          <span>20</span>
          <p>test scenarios before launch</p>
        </div>
      </div>
      <GuidePreview />
      <GuideDownload resource={resource.meta} />
      <section className={styles.faq} aria-labelledby="guide-faq-title">
        <div>
          <p className={styles.eyebrow}>BEFORE YOU START</p>
          <h2 id="guide-faq-title">
            A few things
            <br />
            worth knowing.
          </h2>
          <p className={styles.faqIntro}>
            A clear scope makes a better first step.
          </p>
        </div>
        <div className={styles.questions}>{content}</div>
      </section>
      <section className={styles.closing} aria-labelledby="guide-closing-title">
        <div>
          <p className={styles.eyebrow}>THE NEXT CALL IS A PLACE TO START.</p>
          <h2 id="guide-closing-title">Make a considered first move.</h2>
        </div>
        <a href="#download-form">
          Get the free guide <ArrowUpRight size={20} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
