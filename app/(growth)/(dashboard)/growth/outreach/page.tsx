import { OutreachList } from "@/components/growth/outreach/outreach-list";
import { getOutreachList } from "@/lib/growth/dashboard/outreach";

export default async function OutreachPage() {
  const result = await getOutreachList();
  return <OutreachList result={result} />;
}
