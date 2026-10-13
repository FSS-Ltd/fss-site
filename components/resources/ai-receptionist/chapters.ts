export type GuideChapter = {
  number: string;
  label: string;
  title: string;
  description: string;
  points: readonly string[];
  image: string;
  imageAlt: string;
  page: string;
};

export const guideChapters: readonly GuideChapter[] = [
  {
    number: "01",
    label: "THE FOUNDATION",
    title: "Your business rules. Written down first.",
    description:
      "Give the receptionist a clear brief before you give it a voice. Start with one service, one calendar and the answers your team has approved.",
    points: [
      "A fill-in workbook for hours, services and booking rules",
      "A worked route using Retell AI, Cal.com and Twilio",
      "Calendar conflict checks and a UK number setup walkthrough",
    ],
    image: "/images/resources/ai-receptionist/workbook.webp",
    imageAlt:
      "Page 5: the business-rules workbook with fields for services, hours, booking rules and human handover",
    page: "05",
  },
  {
    number: "02",
    label: "THE CONVERSATION",
    title: "A useful prompt. With clear boundaries.",
    description:
      "Adapt the two-part prompt to your business. Connect real availability and booking tools, then check what happens in the calendar, not just what the assistant says.",
    points: [
      "A copy-and-paste prompt with placeholders to make it yours",
      "Steps for checking availability and confirming a booking",
      "A tested exit route when the caller needs a person",
    ],
    image: "/images/resources/ai-receptionist/prompt.webp",
    imageAlt:
      "Page 10: part one of the receptionist prompt, covering its role, business facts and new bookings",
    page: "10",
  },
  {
    number: "03",
    label: "THE REAL-WORLD CHECK",
    title: "Test the calls you hope not to get.",
    description:
      "A natural-sounding conversation is only the start. Test the awkward dates, unavailable slots and failed transfers before your customers depend on it.",
    points: [
      "20 scenarios covering bookings, failures and handover",
      "Privacy, retention and supplier checks before launch",
      "A staged pilot, rollback plan and final sign-off checklist",
    ],
    image: "/images/resources/ai-receptionist/tests.webp",
    imageAlt:
      "Page 21: the first ten test scenarios, including occupied slots, timezone boundaries and booking failures",
    page: "21",
  },
];
