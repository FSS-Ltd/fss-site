import Link from "next/link";

import styles from "@/components/blog/blog.module.css";

/** Home / Blog / article title. The leaf is cut with an ellipsis by CSS, so a
 *  long headline never wraps the trail; the full title stays in the markup. */
export function BlogBreadcrumbs({ title }: { title: string }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol>
        <li>
          <Link href="/">Home</Link>
        </li>
        <li>
          <Link href="/blog">Blog</Link>
        </li>
        <li className={styles.crumbLeaf}>
          <span aria-current="page" title={title}>
            {title}
          </span>
        </li>
      </ol>
    </nav>
  );
}
