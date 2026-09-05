import Link from "next/link";

export function ContentBreadcrumbs({
  parent,
  title,
}: {
  parent: "Blog" | "Resources";
  title: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 text-sm">
      <ol className="flex flex-wrap items-center gap-3">
        <li>
          <Link href="/" className="underline">
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link
            href={parent === "Blog" ? "/blog" : "/resources"}
            className="underline"
          >
            {parent}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <span aria-current="page">{title}</span>
        </li>
      </ol>
    </nav>
  );
}
