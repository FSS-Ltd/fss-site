import { JsonLd } from "@/components/seo/json-ld";
import { buildRootSchema } from "@/lib/seo/schema";

export function RootSchema() {
  return <JsonLd data={buildRootSchema()} />;
}
