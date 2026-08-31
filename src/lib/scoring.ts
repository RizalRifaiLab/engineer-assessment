import { runCodeInLanguage } from "./codeRunner";
import { deepEqual } from "./compare";
import { normCodingAnswer } from "./languages";
import type {
  CandidateAnswers,
  CodingQuestion,
  McqQuestion,
  Question,
  SanitizedQuestion,
  ScoreBreakdown,
  SqlQuestion,
} from "./types";

export { deepEqual } from "./compare";

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

export async function gradeAnswers(
  questions: FullQuestionSet,
  answers: CandidateAnswers
): Promise<GradingResult> {
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
    const selected = Number.isInteger(answers.mcq[q.id])
      ? answers.mcq[q.id]
      : null;
    const correct = selected === q.correctIndex;
    if (correct) mcqScore += q.points;
    detail.mcq[q.id] = { selected, correct };
  }

  // Remote-language grading makes round-trips, so grade the coding questions in
  // parallel to stay well under the platform function timeout.
  const codingResults = await Promise.all(
    questions.coding.map(async (q) => {
      const ans = normCodingAnswer(answers.coding[q.id]);
      const code = ans.code.trim();
      let tests: { passed: boolean; error?: string }[];
      if (!code) {
        tests = q.testCases.map(() => ({
          passed: false,
          error: "No code submitted.",
        }));
      } else {
        const res = await runCodeInLanguage(ans.language, code, q.testCases);
        tests = res.ok
          ? res.tests
          : q.testCases.map(() => ({ passed: false, error: res.serviceError }));
      }
      const passed = tests.every((t) => t.passed);
      return { q, tests, passed };
    })
  );
  for (const { q, tests, passed } of codingResults) {
    codingTotal += q.points;
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
