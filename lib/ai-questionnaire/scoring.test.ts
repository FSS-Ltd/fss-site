import assert from "node:assert/strict";
import test from "node:test";

import {
  aiQuestionnaireQuestions,
  calculateAiRecommendation,
  type AiQuestionnaireAnswers,
} from "./scoring";

function answersByOptionLabel(labels: string[]): AiQuestionnaireAnswers {
  assert.equal(labels.length, aiQuestionnaireQuestions.length);

  return aiQuestionnaireQuestions.reduce<AiQuestionnaireAnswers>((answers, question, index) => {
    const option = question.options.find((candidate) => candidate.label === labels[index]);

    assert.ok(option, `Missing option "${labels[index]}" for question "${question.id}".`);

    return {
      ...answers,
      [question.id]: option.id,
    };
  }, {});
}

test("recommends local AI for sensitive regulated workflows", () => {
  const result = calculateAiRecommendation(
    answersByOptionLabel([
      "Client, patient, financial, or legally privileged records",
      "Strict legal, clinical, financial, or contractual obligations",
      "We need strong control over where data is processed",
      "Useful within a few seconds is acceptable",
      "We can invest in a controlled private setup",
      "Case files, records, finance, CRM, or internal knowledge bases",
      "Reduce admin while keeping confidential information protected",
    ]),
  );

  assert.equal(result?.recommendation, "local");
});

test("recommends cloud AI for low-risk speed-first workflows", () => {
  const result = calculateAiRecommendation(
    answersByOptionLabel([
      "Public, marketing, or already-approved low-risk content",
      "No special compliance pressure beyond normal business policies",
      "Approved vendors and contracts are enough",
      "We need the fastest possible responses",
      "We need a lean first step without private infrastructure",
      "Email, documents, calendars, or lightweight productivity tools",
      "Move quickly and prove whether AI saves time",
    ]),
  );

  assert.equal(result?.recommendation, "cloud");
});

test("recommends hybrid AI for mixed sensitive and low-risk workflows", () => {
  const result = calculateAiRecommendation(
    answersByOptionLabel([
      "A mix of sensitive and low-risk operational data",
      "Some workflows are regulated, others are routine",
      "Sensitive workflows need control, routine work can use approved cloud tools",
      "Some workflows need speed, others can wait",
      "We can fund a phased approach if the business case is clear",
      "A mix of private records and cloud productivity tools",
      "Separate risky AI use from safe productivity automation",
    ]),
  );

  assert.equal(result?.recommendation, "hybrid");
});

test("returns null until every question has an answer", () => {
  const result = calculateAiRecommendation({
    dataSensitivity: "public-content",
  });

  assert.equal(result, null);
});

test("recommends hybrid AI when local and cloud scores are close", () => {
  const result = calculateAiRecommendation(
    answersByOptionLabel([
      "A mix of sensitive and low-risk operational data",
      "No special compliance pressure beyond normal business policies",
      "Sensitive workflows need control, routine work can use approved cloud tools",
      "We need the fastest possible responses",
      "We can fund a phased approach if the business case is clear",
      "A mix of private records and cloud productivity tools",
      "Move quickly and prove whether AI saves time",
    ]),
  );

  assert.equal(result?.recommendation, "hybrid");
});
