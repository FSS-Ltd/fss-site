import Link from "next/link";

import cta from "@/components/ui/cta-motion.module.css";
import styles from "@/components/blog/blog.module.css";

/** Home / Blog / this article. The leaf names the page without repeating the
 *  headline, which sits directly below; the title stays in its tooltip. */
export function BlogBreadcrumbs({ title }: { title: string }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol>
        <li>
          <Link href="/" className={cta.link}>
            Home
          </Link>
        </li>
        <li>
          <Link href="/blog" className={cta.link}>
            Blog
          </Link>
        </li>
        <li className={styles.crumbLeaf}>
          <span aria-current="page" title={title}>
            This article
          </span>
        </li>
      </ol>
    </nav>
  );
}
