// Field shape for intake step "pre_employment_test" — applicant-side state
// for the Pre-Employment Clinical Judgment Test (RN/LPN). Public/client-safe;
// the answer key lives in clinicalTestScoring.ts (server-only).

import { CLINICAL_TEST_QUESTIONS } from "./clinicalTestQuestions";

export type ClinicalTestAnswerLetter = "A" | "B" | "C" | "D" | "E" | "";

export type ClinicalTestData = {
  examineeName: string;
  positionAppliedFor: string;
  testDate: string;
  answers: Record<number, ClinicalTestAnswerLetter>;
  honorAcknowledged: boolean;
  signatureName: string;
  signatureDate: string;
  // Populated by the server after submission:
  submittedAt: string | null;
  scoreCorrect: number | null;
  scoreTotal: number | null;
  scorePercent: number | null;
  passed: boolean | null;
};

export function emptyClinicalTestData(): ClinicalTestData {
  const answers: Record<number, ClinicalTestAnswerLetter> = {};
  for (const q of CLINICAL_TEST_QUESTIONS) answers[q.number] = "";
  return {
    examineeName: "",
    positionAppliedFor: "",
    testDate: "",
    answers,
    honorAcknowledged: false,
    signatureName: "",
    signatureDate: "",
    submittedAt: null,
    scoreCorrect: null,
    scoreTotal: null,
    scorePercent: null,
    passed: null
  };
}

export function mergeClinicalTestData(stored: unknown): ClinicalTestData {
  const empty = emptyClinicalTestData();
  if (!stored || typeof stored !== "object") return empty;
  const obj = stored as Record<string, unknown>;
  const merged: ClinicalTestData = { ...empty, answers: { ...empty.answers } };
  for (const k of Object.keys(empty) as Array<keyof ClinicalTestData>) {
    const value = obj[k as string];
    if (value === undefined || value === null) continue;
    if (k === "answers") {
      const incoming = value as Record<string, unknown>;
      for (const q of CLINICAL_TEST_QUESTIONS) {
        const cell = incoming[String(q.number)] ?? incoming[q.number as unknown as string];
        if (cell === "A" || cell === "B" || cell === "C" || cell === "D" || cell === "E" || cell === "") {
          merged.answers[q.number] = cell as ClinicalTestAnswerLetter;
        }
      }
      continue;
    }
    (merged as Record<string, unknown>)[k] = value;
  }
  return merged;
}

export function validateClinicalTestForCompletion(data: ClinicalTestData): string[] {
  const errors: string[] = [];
  if (!data.examineeName.trim()) errors.push("Examinee name is required.");
  const unanswered = CLINICAL_TEST_QUESTIONS.filter((q) => !data.answers[q.number]);
  if (unanswered.length > 0) {
    errors.push(`Answer every question. ${unanswered.length} remaining (next: question ${unanswered[0].number}).`);
  }
  if (!data.honorAcknowledged) errors.push("Acknowledge the honor statement.");
  if (!data.signatureName.trim()) errors.push("Type your full legal name to sign.");
  if (!data.signatureDate.trim()) errors.push("Sign date is required.");
  return errors;
}
