import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { LeadMagnetCaptureForm } from "@/components/forms/lead-magnet-capture-form";
import { AI_RECEPTIONIST_GUIDE_PATH } from "@/lib/ai-receptionist-guide";
import type { ResourceMeta } from "@/lib/types/resource";
import styles from "./guide-download.module.css";

export function GuideDownload({ resource }: { resource: ResourceMeta }) {
  return (
    <section className={styles.section} aria-labelledby="download-title">
      <div className={styles.grid}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>YOUR NEXT STEP</p>
          <h2 id="download-title">
            Start small.
            <br />
            Build with <em>confidence.</em>
          </h2>
          <p className={styles.description}>
            Take the workbook, the prompt and the test plan. Work through them
            at your own pace, with a clear route back to a person.
          </p>
          <div className={styles.included}>
            <span>THE COMPLETE GUIDE</span>
            <p>28 pages. Yours to work through.</p>
            <p>
              No subscription to download.
              <br />
              Third-party running costs are separate.
            </p>
          </div>
          <div className={styles.author}>
            <span className={styles.monogram} aria-hidden="true">
              JF
            </span>
            <div>
              <p>Jean-Fidele Ntagengwa</p>
              <span>Software engineer & founder, FSS</span>
              <Link href="/about">
                Meet the author <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
        <div id="download-form" className={styles.formCard}>
          <p className={styles.formEyebrow}>FREE PDF · INSTANT ACCESS</p>
          <h3>Get your copy.</h3>
          <p className={styles.formIntro}>
            Enter your details. Your download will be ready on the next page.
          </p>
          <p id="guide-form-note" className={styles.privacy}>
            Please use business details only. Do not include patient or customer
            information.
          </p>
          <noscript>
            <style>{"#download-form form { display: none; }"}</style>
            <p className={styles.privacy}>
              Please enable JavaScript to request your copy, or{" "}
              <Link href="/contact">contact FSS</Link> for help.
            </p>
          </noscript>
          <LeadMagnetCaptureForm
            resourceSlug={resource.slug}
            sourceContext={`resource:${resource.slug}`}
            ctaLabel={resource.ctaLabel}
            redirectPath={`${AI_RECEPTIONIST_GUIDE_PATH}/thank-you`}
          />
          <p className={styles.privacy}>
            Newsletter signup is optional. Read our{" "}
            <Link href="/privacy">privacy policy</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
