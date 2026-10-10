import type { WelcomePackContent } from "./welcome-pack-contract";

export function interpolateWelcomeCopy(
  value: string,
  facts: Readonly<Record<string, string>>,
): string {
  return value.replace(/{{([a-z_]+)}}/g, (_match, key: string) => {
    const fact = facts[key]?.trim();
    if (!fact)
      throw new Error(
        `Add the client detail for ${key.replaceAll("_", " ")} (${key}) before preparing this welcome.`,
      );
    return fact;
  });
}

export function resolveWelcomePack(
  content: WelcomePackContent,
  facts: Readonly<Record<string, string>>,
  responseHours: number,
): WelcomePackContent {
  const copy = (value: string) => interpolateWelcomeCopy(value, facts);
  return {
    ...content,
    emailSubject: copy(content.emailSubject),
    emailBody: copy(content.emailBody),
    guide: content.guide.map((page) => ({
      ...page,
      title: copy(page.title),
      paragraphs: page.paragraphs.map(copy),
      ...("sectionId" in page && page.sectionId === "communication"
        ? {
            paragraphs: [
              ...page.paragraphs.map(copy),
              `Our usual response expectation is ${responseHours} hours. Any response terms in your agreement take precedence.`,
            ],
          }
        : {}),
    })),
    thankYou: {
      subject: copy(content.thankYou.subject),
      intro: copy(content.thankYou.intro),
      nextStep: copy(content.thankYou.nextStep),
      requiredAction: copy(content.thankYou.requiredAction),
    },
    tasks: content.tasks.map((task) => ({ ...task })),
  };
}
