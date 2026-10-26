// Recognise ordinary opt-out wording without requiring a stored sentence verbatim.
export function offersEmailOptOut(value: string): boolean {
  if (
    /\bopt[ -]?out\b|\bunsubscribe\b|\bno (?:more|further) emails?\b|\bnot hear from me\b/i.test(
      value,
    )
  )
    return true;
  const offersReply =
    /\breply\b|\blet (?:me|us) know\b|\btell (?:me|us)\b/i.test(value);
  const declinesContact =
    /\b(?:do not|don['’]t|did not|didn['’]t|not to|rather not|prefer not|no longer)[\s\S]{0,60}(?:contact|email|hear|receiv|follow[ -]?up|messag)|\b(?:stop|remove)[\s\S]{0,40}(?:email|contact|messag|list)|\bnot interested\b/i.test(
      value,
    );
  return offersReply && declinesContact;
}

export function findEmailOptOut(text: string): string | null {
  return (
    text
      .split(/\n+|(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .find((part) => part.length <= 500 && offersEmailOptOut(part)) ?? null
  );
}

export function findConceptDisclosure(text: string): string | null {
  return (
    text
      .split(/\n+|(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .find(
        (part) =>
          part.length <= 500 &&
          /concept|illustration|mock.?up|prototype|sample|example/i.test(
            part,
          ) &&
          /only|discussion|not (?:an? |the )?(?:existing|finished|live|actual|completed)/i.test(
            part,
          ),
      ) ?? null
  );
}
