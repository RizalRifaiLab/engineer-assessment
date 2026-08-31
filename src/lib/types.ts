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

export type CodeLanguage = "javascript" | "python" | "cpp" | "java";

export interface LanguageStarter {
  language: CodeLanguage;
  label: string;
  signature: string;
  starterCode: string;
}

export interface CodingQuestion {
  kind: "coding";
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  prompt: string;
  languages: LanguageStarter[];
  examples: TestCase[];
  testCases: TestCase[];
  points: number;
}

/** A sample table the candidate can run their SQL against. */
export interface SqlSampleTable {
  name: string;
  columns: { name: string; type: "INT" | "TEXT" | "NUMERIC" }[];
  rows: (string | number | null)[][];
}

export interface SqlQuestion {
  kind: "sql";
  id: string;
  title: string;
  schema?: string;
  prompt: string;
  /** Seed tables (and rows) the candidate's query runs against in the editor. */
  sampleData?: SqlSampleTable[];
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
  languages: LanguageStarter[];
  examples: TestCase[];
  points: number;
}

export interface SanitizedSqlQuestion {
  kind: "sql";
  id: string;
  title: string;
  schema?: string;
  prompt: string;
  sampleData?: SqlSampleTable[];
  points: number;
}

export type SanitizedQuestion =
  | SanitizedMcqQuestion
  | SanitizedCodingQuestion
  | SanitizedSqlQuestion;

export interface CodingAnswer {
  language: CodeLanguage;
  code: string;
}

export interface CandidateAnswers {
  mcq: Record<string, number>;
  /** Per question: the chosen language plus the candidate's code. */
  coding: Record<string, CodingAnswer>;
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
