import { CommercialPage } from "@/components/sections/public/commercial-page";
import { commercialPages } from "@/lib/commercial/pages";
import { createPageMetadata } from "@/lib/seo/metadata";

const page = commercialPages["/services/software-modernisation"];
export const metadata = createPageMetadata(page);

export default function Page() {
  return <CommercialPage page={page} />;
}
