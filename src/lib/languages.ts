import type { CodeLanguage, CodingAnswer, LanguageStarter } from "./types";

/**
 * Shared language configuration. JavaScript runs locally in a `node:vm`
 * sandbox; the other languages are executed remotely through Judge0's free
 * community CE instance. This mirrors the design of the original Piston plan,
 * and swapping backends later only means changing `judge0Id` handling.
 */
export const CODE_LANGUAGES: CodeLanguage[] = ["javascript", "python", "cpp", "java"];

export const LANGUAGE_META: Record<
  CodeLanguage,
  { label: string; judge0Id: number | null }
> = {
  javascript: { label: "JavaScript (Node)", judge0Id: null },
  python: { label: "Python 3", judge0Id: 92 }, // Python 3.11.2
  cpp: { label: "C++ (GCC 14)", judge0Id: 105 }, // C++ GCC 14.1.0
  java: { label: "Java (JDK 17)", judge0Id: 91 }, // Java JDK 17.0.6
};

export function isCodeLanguage(v: unknown): v is CodeLanguage {
  return typeof v === "string" && (CODE_LANGUAGES as string[]).includes(v);
}

/**
 * Normalizes a stored coding answer. Attempts created before the
 * multi-language change stored a plain code string (always JavaScript), so
 * convert those into the new `{ language, code }` shape.
 */
export function normCodingAnswer(v: unknown): CodingAnswer {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as { language?: unknown; code?: unknown };
    return {
      language: isCodeLanguage(o.language) ? o.language : "javascript",
      code: typeof o.code === "string" ? o.code : "",
    };
  }
  if (typeof v === "string") return { language: "javascript", code: v };
  return { language: "javascript", code: "" };
}

/** The starter (signature + code) for a given question and language. */
export function starterFor(
  question: { languages?: LanguageStarter[] },
  language: CodeLanguage
): LanguageStarter | null {
  return question.languages?.find((l) => l.language === language) ?? null;
}

export function defaultStarter(
  question: { languages?: LanguageStarter[] }
): LanguageStarter {
  return (
    question.languages?.[0] ?? {
      language: "javascript",
      label: "JavaScript (Node)",
      signature: "solve(...)",
      starterCode: "function solve() {\n  // your code here\n}",
    }
  );
}

/**
 * Whether a coding answer counts as "filled": non-empty code that differs from
 * the untouched starter code for the chosen language.
 */
export function codingAnswered(
  answer: CodingAnswer | undefined,
  question: { languages?: LanguageStarter[] }
): boolean {
  if (!answer) return false;
  const code = answer.code.trim();
  if (code === "") return false;
  const starter = starterFor(question, answer.language);
  if (starter && code === starter.starterCode.trim()) return false;
  return true;
}
