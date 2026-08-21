import { IssueList } from "@/components/growth/newsletter/issue-list";
import { getNewsletterIssueList } from "@/lib/growth/dashboard/newsletter";

export default async function NewsletterPage() {
  const result = await getNewsletterIssueList();
  return <IssueList result={result} />;
}
