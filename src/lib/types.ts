export type Category = "sql" | "logic" | "coding";

export interface McqQuestion {
  kind: "mcq";
  id: string;
  category: Category;
  prompt: string;
  code?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  points: number;
}

export interface TestCase {
  args: unknown[];
  expected: unknown;
}

export interface CodingQuestion {
  kind: "coding";
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  prompt: string;
  signature: string;
  starterCode: string;
  examples: TestCase[];
  testCases: TestCase[];
  points: number;
}

export interface SqlQuestion {
  kind: "sql";
  id: string;
  title: string;
  schema?: string;
  prompt: string;
  points: number;
}

export type Question = McqQuestion | CodingQuestion | SqlQuestion;

export interface Section {
  id: "mcq" | "coding" | "sql";
  title: string;
  description: string;
}

// --- Client-safe (sanitized) variants: no answers, no test cases ---

export interface SanitizedMcqQuestion {
  kind: "mcq";
  id: string;
  category: Category;
  prompt: string;
  code?: string;
  options: string[];
  points: number;
}

export interface SanitizedCodingQuestion {
  kind: "coding";
  id: string;
  title: string;
  difficulty: string;
  prompt: string;
  signature: string;
  starterCode: string;
  examples: TestCase[];
  points: number;
}

export interface SanitizedSqlQuestion {
  kind: "sql";
  id: string;
  title: string;
  schema?: string;
  prompt: string;
  points: number;
}

export type SanitizedQuestion =
  | SanitizedMcqQuestion
  | SanitizedCodingQuestion
  | SanitizedSqlQuestion;

export interface CandidateAnswers {
  mcq: Record<string, number>;
  coding: Record<string, string>;
  sql: Record<string, string>;
}

export interface ScoreBreakdown {
  mcqScore: number;
  mcqTotal: number;
  codingScore: number;
  codingTotal: number;
  sqlScore: number | null;
  sqlTotal: number;
  autoScore: number;
  totalPossible: number;
}
