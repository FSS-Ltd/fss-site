import type { ReactNode } from "react";

import styles from "@/components/blog/blog.module.css";

type MdxCalloutProps = {
  title?: string;
  children: ReactNode;
};

export function MdxCallout({ title = "Note", children }: MdxCalloutProps) {
  return (
    <aside className={styles.callout}>
      <p className={styles.label}>{title}</p>
      <div>{children}</div>
    </aside>
  );
}
