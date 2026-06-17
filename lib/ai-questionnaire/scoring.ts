export type AiDeploymentRecommendation = "local" | "cloud" | "hybrid";

export type AiScore = Record<AiDeploymentRecommendation, number>;

export type AiQuestionOption = {
  id: string;
  label: string;
  description: string;
  score: AiScore;
};

export type AiQuestion = {
  id: string;
  eyebrow: string;
  question: string;
  options: AiQuestionOption[];
};

export type AiQuestionnaireAnswers = Partial<Record<AiQuestion["id"], AiQuestionOption["id"]>>;

export type AiRecommendationContent = {
  title: string;
  summary: string;
  bestFit: string;
  riskNote: string;
  ctaNote: string;
  bullets: string[];
};

export type AiRecommendationResult = AiRecommendationContent & {
  recommendation: AiDeploymentRecommendation;
  score: AiScore;
};

const localScore: AiScore = { local: 4, cloud: 0, hybrid: 1 };
const cloudScore: AiScore = { local: 0, cloud: 4, hybrid: 1 };
const hybridScore: AiScore = { local: 2, cloud: 2, hybrid: 4 };

export const aiQuestionnaireQuestions: AiQuestion[] = [
  {
    id: "dataSensitivity",
    eyebrow: "Data",
    question: "What kind of data would AI touch?",
    options: [
      {
        id: "sensitive-records",
        label: "Client, patient, financial, or legally privileged records",
        description: "The AI would work near confidential records or high-risk operational data.",
        score: localScore,
      },
      {
        id: "public-content",
        label: "Public, marketing, or already-approved low-risk content",
        description: "The work is mostly public, internal admin, or approved for third-party tools.",
        score: cloudScore,
      },
      {
        id: "mixed-data",
        label: "A mix of sensitive and low-risk operational data",
        description: "Some workflows are confidential while others are safe for approved cloud tools.",
        score: hybridScore,
      },
    ],
  },
  {
    id: "compliancePressure",
    eyebrow: "Governance",
    question: "Which compliance or assurance pressure applies?",
    options: [
      {
        id: "strict-obligations",
        label: "Strict legal, clinical, financial, or contractual obligations",
        description: "You need strong evidence around data handling, oversight, and access control.",
        score: localScore,
      },
      {
        id: "standard-policies",
        label: "No special compliance pressure beyond normal business policies",
        description: "A well-governed vendor agreement is likely enough for the first use cases.",
        score: cloudScore,
      },
      {
        id: "mixed-obligations",
        label: "Some workflows are regulated, others are routine",
        description: "Your AI policy needs separate lanes for sensitive and non-sensitive work.",
        score: hybridScore,
      },
    ],
  },
  {
    id: "processingControl",
    eyebrow: "Control",
    question: "How much control do you need over where data is processed?",
    options: [
      {
        id: "strong-control",
        label: "We need strong control over where data is processed",
        description: "You want private infrastructure, restricted access, and clear audit boundaries.",
        score: localScore,
      },
      {
        id: "vendor-control",
        label: "Approved vendors and contracts are enough",
        description: "You can use cloud providers if policies, terms, and permissions are clear.",
        score: cloudScore,
      },
      {
        id: "split-control",
        label: "Sensitive workflows need control, routine work can use approved cloud tools",
        description: "You need a practical split rather than one rule for every workflow.",
        score: hybridScore,
      },
    ],
  },
  {
    id: "latency",
    eyebrow: "Performance",
    question: "How fast do answers need to be?",
    options: [
      {
        id: "seconds-acceptable",
        label: "Useful within a few seconds is acceptable",
        description: "Reliability and governance matter more than using the fastest public model.",
        score: { local: 3, cloud: 0, hybrid: 1 },
      },
      {
        id: "fastest-possible",
        label: "We need the fastest possible responses",
        description: "Speed and model capability are more important than private hosting.",
        score: cloudScore,
      },
      {
        id: "mixed-speed",
        label: "Some workflows need speed, others can wait",
        description: "Different workflows should use different AI deployment patterns.",
        score: hybridScore,
      },
    ],
  },
  {
    id: "capacity",
    eyebrow: "Investment",
    question: "What budget and technical capacity do you have?",
    options: [
      {
        id: "private-investment",
        label: "We can invest in a controlled private setup",
        description: "You can support a more deliberate architecture if it reduces risk.",
        score: localScore,
      },
      {
        id: "lean-first-step",
        label: "We need a lean first step without private infrastructure",
        description: "You need a lower-friction pilot before committing to private AI infrastructure.",
        score: cloudScore,
      },
      {
        id: "phased-business-case",
        label: "We can fund a phased approach if the business case is clear",
        description: "You want to prove value first, then reserve private AI for higher-risk workflows.",
        score: hybridScore,
      },
    ],
  },
  {
    id: "integrations",
    eyebrow: "Systems",
    question: "What systems should the AI connect to?",
    options: [
      {
        id: "private-systems",
        label: "Case files, records, finance, CRM, or internal knowledge bases",
        description: "The agent would need access to systems that carry sensitive business context.",
        score: localScore,
      },
      {
        id: "productivity-tools",
        label: "Email, documents, calendars, or lightweight productivity tools",
        description: "The first workflows can live around everyday productivity systems.",
        score: cloudScore,
      },
      {
        id: "mixed-systems",
        label: "A mix of private records and cloud productivity tools",
        description: "The architecture needs both controlled internal access and approved cloud workflows.",
        score: hybridScore,
      },
    ],
  },
  {
    id: "businessOutcome",
    eyebrow: "Outcome",
    question: "What is the first business outcome you want?",
    options: [
      {
        id: "protected-admin",
        label: "Reduce admin while keeping confidential information protected",
        description: "You want automation, but not at the cost of privacy or professional obligations.",
        score: localScore,
      },
      {
        id: "prove-speed",
        label: "Move quickly and prove whether AI saves time",
        description: "You want a fast pilot with clear operational value.",
        score: cloudScore,
      },
      {
        id: "separate-risk",
        label: "Separate risky AI use from safe productivity automation",
        description: "You want governance and profit improvement without treating all workflows the same.",
        score: hybridScore,
      },
    ],
  },
];

export const aiRecommendationContent: Record<AiDeploymentRecommendation, AiRecommendationContent> = {
  local: {
    title: "Local AI is likely the safest first move.",
    summary:
      "Your answers point toward private processing, controlled access, and clear audit boundaries before AI touches sensitive work.",
    bestFit:
      "Best fit for law firms, clinics, hospitals, finance teams, and service businesses handling confidential records.",
    riskNote:
      "Local AI still needs governance, testing, monitoring, and human review. The advantage is that sensitive data can stay inside a controlled environment.",
    ctaNote:
      "The next step is to map one high-admin workflow and design the smallest private AI pilot that can prove value safely.",
    bullets: [
      "Keep sensitive records away from unmanaged public AI tools.",
      "Design agents around permissions, logs, and human approval.",
      "Automate admin without weakening confidentiality or trust.",
    ],
  },
  cloud: {
    title: "Cloud AI is likely the fastest first move.",
    summary:
      "Your answers suggest the first use cases are lower risk, speed matters, and approved third-party providers can support a useful pilot.",
    bestFit:
      "Best fit for teams starting with marketing, research, drafting, meeting notes, or low-risk internal productivity work.",
    riskNote:
      "Cloud AI still needs vendor checks, usage rules, and data boundaries. Do not put sensitive records into tools that are not approved for that data.",
    ctaNote:
      "The next step is to define approved use cases, select safe tooling, and measure which workflows actually save time.",
    bullets: [
      "Launch quickly with approved vendors and clear usage rules.",
      "Avoid infrastructure cost while proving business value.",
      "Reserve private AI for workflows that later touch sensitive data.",
    ],
  },
  hybrid: {
    title: "A hybrid AI setup is likely the right answer.",
    summary:
      "Your answers show a split environment: some workflows need private control, while others can move faster with approved cloud AI.",
    bestFit:
      "Best fit for organisations with sensitive records and routine admin living side by side.",
    riskNote:
      "Hybrid AI only works if the boundaries are explicit. Staff need to know which workflows are local, which are cloud-approved, and which are off-limits.",
    ctaNote:
      "The next step is to create an AI workflow map that separates confidential automation from safe productivity gains.",
    bullets: [
      "Keep confidential workflows local or private by design.",
      "Use approved cloud AI where data risk is low and speed matters.",
      "Create a policy and workflow map staff can actually follow.",
    ],
  },
};

function emptyScore(): AiScore {
  return { local: 0, cloud: 0, hybrid: 0 };
}

function addScore(total: AiScore, score: AiScore): AiScore {
  return {
    local: total.local + score.local,
    cloud: total.cloud + score.cloud,
    hybrid: total.hybrid + score.hybrid,
  };
}

function getRecommendationFromScore(score: AiScore): AiDeploymentRecommendation {
  const highestScore = Math.max(score.local, score.cloud, score.hybrid);
  const localCloudDifference = Math.abs(score.local - score.cloud);

  if (highestScore - score.hybrid <= 2) {
    return "hybrid";
  }

  if (localCloudDifference <= 2) {
    return "hybrid";
  }

  return score.local > score.cloud ? "local" : "cloud";
}

export function calculateAiRecommendation(
  answers: AiQuestionnaireAnswers,
): AiRecommendationResult | null {
  let score = emptyScore();

  for (const question of aiQuestionnaireQuestions) {
    const selectedOptionId = answers[question.id];

    if (!selectedOptionId) {
      return null;
    }

    const option = question.options.find((candidate) => candidate.id === selectedOptionId);

    if (!option) {
      return null;
    }

    score = addScore(score, option.score);
  }

  const recommendation = getRecommendationFromScore(score);

  return {
    recommendation,
    score,
    ...aiRecommendationContent[recommendation],
  };
}
