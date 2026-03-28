import "server-only";

type SendResendEmailParams = {
  apiKey: string;
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

type ResendSendResponse = {
  id?: string;
};

function isValidReplyTo(value: string): boolean {
  const plainEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const namedEmailPattern = /^.+<\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*>$/;

  return plainEmailPattern.test(value) || namedEmailPattern.test(value);
}

export async function sendResendEmail(params: SendResendEmailParams): Promise<string> {
  const replyTo = params.replyTo?.trim();
  const shouldIncludeReplyTo = Boolean(replyTo) && isValidReplyTo(replyTo);

  if (replyTo && !shouldIncludeReplyTo) {
    console.warn("Resend reply-to is invalid. Sending email without reply-to header.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(shouldIncludeReplyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend send failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as ResendSendResponse;

  if (!data.id) {
    throw new Error("Resend send succeeded but no message id was returned.");
  }

  return data.id;
}
