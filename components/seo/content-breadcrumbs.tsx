import Link from "next/link";
import cta from "@/components/ui/cta-motion.module.css";

export function ContentBreadcrumbs({
  parent,
}: {
  parent: "Blog" | "Resources";
  /** The page title; shown by the heading, not the trail. */
  title?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 text-sm">
      <ol className="flex flex-wrap items-center gap-3">
        <li>
          <Link href="/" className={`inline-block py-3 underline ${cta.link}`}>
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link
            href={parent === "Blog" ? "/blog" : "/resources"}
            className={`inline-block py-3 underline ${cta.link}`}
          >
            {parent}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          {/* The title is the page heading right below; repeating it adds nothing. */}
          <span aria-current="page">
            {parent === "Blog" ? "Article" : "Resource"}
          </span>
        </li>
      </ol>
    </nav>
  );
}
