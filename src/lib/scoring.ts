import { runCode } from "./codeRunner";
import type {
  CandidateAnswers,
  CodingQuestion,
  McqQuestion,
  Question,
  SanitizedQuestion,
  ScoreBreakdown,
  SqlQuestion,
} from "./types";

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length) return false;
    return ka.every((k, i) => k === kb[i] && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** Strip correct answers / test cases / explanations before sending to the client. */
export function sanitizeQuestions(questions: Question[]): SanitizedQuestion[] {
  return questions.map((q) => {
    if (q.kind === "mcq") {
      const { correctIndex: _c, explanation: _e, ...rest } = q;
      return rest as unknown as SanitizedQuestion;
    }
    if (q.kind === "coding") {
      const { testCases: _t, ...rest } = q;
      return rest as unknown as SanitizedQuestion;
    }
    return q as unknown as SanitizedQuestion;
  });
}

interface FullQuestionSet {
  mcq: McqQuestion[];
  coding: CodingQuestion[];
  sql: SqlQuestion[];
}

interface GradingDetail {
  mcq: Record<string, { selected: number | null; correct: boolean }>;
  coding: Record<string, { passed: boolean; tests: { passed: boolean; error?: string }[] }>;
}

export interface GradingResult {
  breakdown: ScoreBreakdown;
  detail: GradingDetail;
}

export function gradeAnswers(questions: FullQuestionSet, answers: CandidateAnswers): GradingResult {
  let mcqScore = 0;
  let mcqTotal = 0;
  let codingScore = 0;
  let codingTotal = 0;
  let sqlTotal = 0;

  const detail: GradingDetail = {
    mcq: {},
    coding: {},
  };

  for (const q of questions.mcq) {
    mcqTotal += q.points;
    const selected = Number.isInteger(answers.mcq[q.id]) ? answers.mcq[q.id] : null;
    const correct = selected === q.correctIndex;
    if (correct) mcqScore += q.points;
    detail.mcq[q.id] = { selected, correct };
  }

  for (const q of questions.coding) {
    codingTotal += q.points;
    const code = (answers.coding[q.id] || "").trim();
    const tests = q.testCases.map((tc) => {
      if (!code) return { passed: false, error: "No code submitted." };
      const r = runCode(code, tc.args);
      return { passed: r.ok && deepEqual(r.result, tc.expected), error: r.error };
    });
    const passed = tests.every((t) => t.passed);
    if (passed) codingScore += q.points;
    detail.coding[q.id] = { passed, tests };
  }

  for (const q of questions.sql) {
    sqlTotal += q.points;
  }

  const autoScore = mcqScore + codingScore;
  const totalPossible = mcqTotal + codingTotal + sqlTotal;

  return {
    breakdown: {
      mcqScore,
      mcqTotal,
      codingScore,
      codingTotal,
      sqlScore: null,
      sqlTotal,
      autoScore,
      totalPossible,
    },
    detail,
  };
}
