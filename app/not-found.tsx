import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#07182e] px-6 py-20 text-white">
      <div className="max-w-xl">
        <p className="mb-12 text-sm font-semibold tracking-wider text-[#46c7d8]">
          Faithful Software Solutions
        </p>
        <p className="mb-4 text-sm text-[#b7c4d3]">404</p>
        <h1 className="mb-6 text-4xl font-semibold tracking-tight sm:text-5xl">
          We couldn’t find that page.
        </h1>
        <p className="mb-8 text-lg text-[#b7c4d3]">
          The link may have changed. Visit our homepage or contact us for help.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            className="rounded-full bg-[#46c7d8] px-6 py-3 font-semibold text-[#07182e] focus-visible:outline-2 focus-visible:outline-offset-4"
            href="/"
          >
            Go to homepage
          </Link>
          <Link
            className="rounded-full border border-white/40 px-6 py-3 focus-visible:outline-2 focus-visible:outline-offset-4"
            href="/contact"
          >
            Contact FSS
          </Link>
        </div>
      </div>
    </main>
  );
}
