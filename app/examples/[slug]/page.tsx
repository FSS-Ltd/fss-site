import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  findSectorExample,
  sectorExamples,
} from "@/lib/sector-examples/catalog";
import { ExampleChrome } from "@/components/sector-examples/chrome";
import { ExampleMotion } from "@/components/sector-examples/motion";
import { examplePages } from "@/components/sector-examples/registry";

export const dynamicParams = false;
export function generateStaticParams() {
  return sectorExamples.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const example = findSectorExample((await params).slug);
  return {
    title: example
      ? `${example.name} | ${example.sector} example by FSS`
      : "Example not found",
    description: example?.description,
    alternates: { canonical: `/examples/${(await params).slug}` },
  };
}
export default async function ExamplePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const example = findSectorExample((await params).slug);
  if (!example) notFound();
  const Page = examplePages[example.slug];
  if (!Page) notFound();
  return (
    <ExampleMotion>
      <ExampleChrome example={example}>
        <Page />
      </ExampleChrome>
    </ExampleMotion>
  );
}
