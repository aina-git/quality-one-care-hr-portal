// Server-only scoring for the Pre-Employment Clinical Judgment Test.
// The answer key MUST NOT be imported into client code. The "server-only"
// marker below makes Next.js error at build time if a client component
// tries to import this module.

import "server-only";

import { CLINICAL_TEST_PASS_THRESHOLD, CLINICAL_TEST_QUESTIONS } from "./clinicalTestQuestions";

const ANSWER_KEY: Record<number, "A" | "B" | "C" | "D" | "E"> = {
  1: "B",
  2: "A",
  3: "D",
  4: "D",
  5: "B",
  6: "E",
  7: "B",
  8: "B",
  9: "C",
  10: "D",
  11: "B",
  12: "A",
  13: "B",
  14: "C"
};

export type ClinicalTestSubmission = Record<number, "A" | "B" | "C" | "D" | "E" | "">;

export type ClinicalTestScoreResult = {
  total: number;
  correct: number;
  percentage: number;
  passed: boolean;
  perQuestion: Array<{ number: number; selected: string; correct: string; isCorrect: boolean }>;
};

export function scoreClinicalTest(submission: ClinicalTestSubmission): ClinicalTestScoreResult {
  const perQuestion = CLINICAL_TEST_QUESTIONS.map((q) => {
    const selected = String(submission[q.number] ?? "");
    const correctAnswer = ANSWER_KEY[q.number];
    return {
      number: q.number,
      selected,
      correct: correctAnswer,
      isCorrect: selected === correctAnswer
    };
  });
  const correct = perQuestion.filter((r) => r.isCorrect).length;
  const total = CLINICAL_TEST_QUESTIONS.length;
  const percentage = Math.round((correct / total) * 100);
  const passed = correct >= CLINICAL_TEST_PASS_THRESHOLD;
  return { total, correct, percentage, passed, perQuestion };
}
