import Link from "next/link";

import { Container } from "@/components/ui/container";
import { getDeliveryAction } from "@/lib/resource-delivery";
import type { ResourceMeta } from "@/lib/types/resource";

import styles from "./plumber-prompt-kit.module.css";

type PlumberPromptKitThankYouProps = {
  resource: ResourceMeta;
};

export function PlumberPromptKitThankYou({
  resource,
}: PlumberPromptKitThankYouProps) {
  const download = getDeliveryAction(resource);

  return (
    <div className={styles.page}>
      <Container>
        <section className={styles.thankYou}>
          <p className={styles.eyebrow}>Your prompt kit is ready</p>
          <h1>Start with one task.</h1>
          <p>{resource.thankYouMessage}</p>
          {download ? (
            <a
              href={download.href}
              download={download.download}
              className={styles.downloadButton}
            >
              {download.label}
            </a>
          ) : null}
          <p className={styles.downloadHelp}>
            If the download does not start, open the link in a new tab.
          </p>
          <Link
            href={`/resources/${resource.slug}`}
            className={styles.backLink}
          >
            ← Back to the guide
          </Link>
        </section>
      </Container>
    </div>
  );
}
