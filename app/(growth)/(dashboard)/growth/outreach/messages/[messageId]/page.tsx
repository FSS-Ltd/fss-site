import { resolveSiteUrl } from "@/lib/config/site-url";
import { MessageReview } from "@/components/growth/outreach/message-review";
import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getMessageReview } from "@/lib/growth/dashboard/message-review";

type MessageReviewPageProps = {
  params: Promise<{ messageId: string }>;
};

export default async function MessageReviewPage({
  params,
}: MessageReviewPageProps) {
  const { messageId } = await params;
  const result = await getMessageReview(
    messageId,
    readGrowthServerEnv().ownerEmail,
    resolveSiteUrl(),
  );

  return <MessageReview result={result} />;
}
