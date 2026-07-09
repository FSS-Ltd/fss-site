import { z } from "zod";

export type IntakeSelectOption = {
  id: string;
  label: string;
  description?: string;
};

const stageIds = ["idea", "building", "running", "growing"] as const;
const demandEvidenceIds = ["none", "informal", "paid"] as const;
const primaryGoalIds = [
  "test-demand",
  "first-customers",
  "credibility",
  "launch-product",
  "grow-audience",
] as const;
const audienceSizeIds = ["none", "small", "growing", "large"] as const;
const productNeedIds = ["show-information", "people-do-things", "not-sure"] as const;
const willingnessToPayIds = ["already-pay", "believe-so", "not-sure"] as const;
const budgetIds = ["under-1k", "1k-5k", "5k-20k", "over-20k", "not-sure"] as const;

export const stageOptions: IntakeSelectOption[] = [
  { id: "idea", label: "Just an idea" },
  { id: "building", label: "Building it now" },
  { id: "running", label: "Already running" },
  { id: "growing", label: "Have a product, want to grow" },
];

export const demandEvidenceOptions: IntakeSelectOption[] = [
  { id: "none", label: "No, not yet" },
  { id: "informal", label: "Some informal interest" },
  { id: "paid", label: "Yes — people have paid or committed" },
];

export const primaryGoalOptions: IntakeSelectOption[] = [
  { id: "test-demand", label: "Test whether the idea has demand" },
  { id: "first-customers", label: "Get my first customers" },
  { id: "credibility", label: "Be credible and findable" },
  { id: "launch-product", label: "Launch a working product" },
  { id: "grow-audience", label: "Grow an audience" },
];

export const audienceSizeOptions: IntakeSelectOption[] = [
  { id: "none", label: "None yet" },
  { id: "small", label: "Small (fewer than 1,000)" },
  { id: "growing", label: "Growing (1,000–10,000)" },
  { id: "large", label: "Large (10,000+)" },
];

export const productNeedOptions: IntakeSelectOption[] = [
  { id: "show-information", label: "Mostly show information" },
  {
    id: "people-do-things",
    label: "People need to do things",
    description: "Accounts, tools, bookings, transactions.",
  },
  { id: "not-sure", label: "Not sure yet" },
];

export const willingnessToPayOptions: IntakeSelectOption[] = [
  { id: "already-pay", label: "They already do" },
  { id: "believe-so", label: "I believe so" },
  { id: "not-sure", label: "Not sure yet" },
];

export const budgetOptions: IntakeSelectOption[] = [
  { id: "under-1k", label: "Under £1,000" },
  { id: "1k-5k", label: "£1,000–£5,000" },
  { id: "5k-20k", label: "£5,000–£20,000" },
  { id: "over-20k", label: "£20,000+" },
  { id: "not-sure", label: "Not sure" },
];

export const intakeSubmissionSchema = z.object({
  firstName: z.string().min(2, "Please enter your first name.").max(80),
  email: z.string().email("Please enter a valid email."),
  businessName: z.string().max(120).optional(),
  stage: z.enum(stageIds, { message: "Please select your current stage." }),

  ideaDescription: z
    .string()
    .min(10, "Please describe your idea in a little more detail.")
    .max(2000, "Please keep this under 2000 characters."),
  problem: z
    .string()
    .min(10, "Please describe the problem in a little more detail.")
    .max(2000, "Please keep this under 2000 characters."),
  targetCustomer: z
    .string()
    .min(10, "Please describe who this is for in a little more detail.")
    .max(2000, "Please keep this under 2000 characters."),

  currentAlternatives: z.string().max(2000, "Please keep this under 2000 characters.").optional(),
  customerConversations: z
    .string()
    .max(2000, "Please keep this under 2000 characters.")
    .optional(),
  demandEvidence: z.enum(demandEvidenceIds, {
    message: "Please select the option that best describes your evidence so far.",
  }),
  demandEvidenceDetail: z
    .string()
    .max(2000, "Please keep this under 2000 characters.")
    .optional(),

  goals6to12Months: z
    .string()
    .min(10, "Please share a little more about your goals.")
    .max(2000, "Please keep this under 2000 characters."),
  primaryGoal: z.enum(primaryGoalIds, {
    message: "Please select your primary goal right now.",
  }),
  successDefinition: z.string().max(2000, "Please keep this under 2000 characters.").optional(),

  audienceSize: z.enum(audienceSizeIds, {
    message: "Please select your current audience size.",
  }),
  audienceLocation: z.string().max(300, "Please keep this under 300 characters.").optional(),
  productNeed: z.enum(productNeedIds, {
    message: "Please select the option that best describes what your idea needs.",
  }),
  willingnessToPay: z.enum(willingnessToPayIds, {
    message: "Please select the option that best describes willingness to pay.",
  }),
  budget: z.enum(budgetIds).optional(),
  biggestObstacle: z.string().max(2000, "Please keep this under 2000 characters.").optional(),
  additionalNotes: z.string().max(2000, "Please keep this under 2000 characters.").optional(),

  botField: z.string().max(200).optional(),
});

export type IntakeSubmissionValues = z.infer<typeof intakeSubmissionSchema>;

export const intakeSubmissionPayloadSchema = intakeSubmissionSchema.extend({
  sourcePath: z.string().min(1),
});

export type IntakeSubmissionPayload = z.infer<typeof intakeSubmissionPayloadSchema>;

export type IntakeFieldType = "text" | "email" | "textarea" | "select";

export type IntakeField = {
  id: keyof IntakeSubmissionValues;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  placeholder?: string;
  helperText?: string;
  autoComplete?: string;
  options?: IntakeSelectOption[];
};

export type IntakeStep = {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  fields: IntakeField[];
};

export const intakeSteps: IntakeStep[] = [
  {
    id: "about-you",
    eyebrow: "Step 01",
    title: "About you",
    fields: [
      {
        id: "firstName",
        label: "First name",
        type: "text",
        required: true,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        id: "email",
        label: "Email",
        type: "email",
        required: true,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        id: "businessName",
        label: "Business or project name (optional)",
        type: "text",
        required: false,
        placeholder: "Not registered yet? Just describe it.",
      },
      {
        id: "stage",
        label: "What stage are you at?",
        type: "select",
        required: true,
        options: stageOptions,
      },
    ],
  },
  {
    id: "the-idea",
    eyebrow: "Step 02",
    title: "The idea",
    fields: [
      {
        id: "ideaDescription",
        label: "Describe your idea in a few sentences",
        type: "textarea",
        required: true,
      },
      {
        id: "problem",
        label: "What problem does it solve?",
        type: "textarea",
        required: true,
      },
      {
        id: "targetCustomer",
        label: "Who is it for — your target customer?",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: "problem-evidence",
    eyebrow: "Step 03",
    title: "The problem & evidence",
    description: "Real signal comes from what people already do, not what they say they'd do.",
    fields: [
      {
        id: "currentAlternatives",
        label: "How do people solve this today, without you? (optional)",
        type: "textarea",
        required: false,
      },
      {
        id: "customerConversations",
        label: "Have you spoken to potential customers? What did they say? (optional)",
        type: "textarea",
        required: false,
      },
      {
        id: "demandEvidence",
        label: "What evidence of demand do you have so far?",
        type: "select",
        required: true,
        options: demandEvidenceOptions,
      },
      {
        id: "demandEvidenceDetail",
        label: "Anything to add about that evidence? (optional)",
        type: "textarea",
        required: false,
      },
    ],
  },
  {
    id: "goals-success",
    eyebrow: "Step 04",
    title: "Goals & success",
    fields: [
      {
        id: "goals6to12Months",
        label: "What do you want to achieve in the next 6–12 months?",
        type: "textarea",
        required: true,
      },
      {
        id: "primaryGoal",
        label: "What's your primary goal right now?",
        type: "select",
        required: true,
        options: primaryGoalOptions,
      },
      {
        id: "successDefinition",
        label: "What would success look like to you? (optional)",
        type: "textarea",
        required: false,
      },
    ],
  },
  {
    id: "reach-product-needs",
    eyebrow: "Step 05",
    title: "Reach, product needs & commitment",
    fields: [
      {
        id: "audienceSize",
        label: "Do you already have an audience?",
        type: "select",
        required: true,
        options: audienceSizeOptions,
      },
      {
        id: "audienceLocation",
        label: "Where is that audience? (optional)",
        type: "text",
        required: false,
        placeholder: "e.g. Instagram, a newsletter, a local community",
      },
      {
        id: "productNeed",
        label: "Does your idea mainly need to show information, or let people do things?",
        type: "select",
        required: true,
        options: productNeedOptions,
      },
      {
        id: "willingnessToPay",
        label: "Would customers pay for this?",
        type: "select",
        required: true,
        options: willingnessToPayOptions,
      },
      {
        id: "budget",
        label: "Budget you can invest to get started (optional)",
        type: "select",
        required: false,
        options: budgetOptions,
      },
      {
        id: "biggestObstacle",
        label: "Biggest obstacle right now (optional)",
        type: "textarea",
        required: false,
      },
      {
        id: "additionalNotes",
        label: "Anything else we should know? (optional)",
        type: "textarea",
        required: false,
      },
    ],
  },
];
