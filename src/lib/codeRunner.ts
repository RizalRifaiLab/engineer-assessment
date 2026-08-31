import { runInNewContext } from "node:vm";
import { deepEqual } from "./compare";
import { buildHarness } from "./harness";
import { LANGUAGE_META } from "./languages";
import type { CodeLanguage, TestCase } from "./types";

export interface RunResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Runs a candidate's JavaScript solution on the server in an isolated V8
 * context with a hard timeout. Expects the code to define a function named
 * `solve` and calls it with the provided arguments.
 */
export function runCode(code: string, args: unknown[]): RunResult {
  const sandbox: Record<string, unknown> = {
    args,
    __result: undefined,
    __error: undefined,
  };

  const harness = `
;(function () {
  try {
    if (typeof solve !== "function") {
      __error = "Your code must define a function named 'solve'.";
      return;
    }
    __result = solve.apply(null, args);
  } catch (e) {
    __error = e && e.message ? e.message : String(e);
  }
})();
`;

  try {
    runInNewContext(code + "\n" + harness, sandbox, {
      timeout: 3000,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err && err.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") {
      return { ok: false, error: "Timed out — possible infinite loop." };
    }
    return { ok: false, error: (err && err.message) || String(e) };
  }

  if (sandbox.__error) {
    return { ok: false, error: String(sandbox.__error) };
  }
  return { ok: true, result: sandbox.__result };
}

// --- Multi-language execution (Judge0 CE, free community instance) ---

const JUDGE0_URL =
  process.env.JUDGE0_URL || "https://ce.judge0.com";
const POLL_TIMEOUT_MS = 25000;

export interface Judge0Output {
  statusId: number;
  stdout: string;
  stderr: string;
  compileOutput: string;
}

/** Submits source to Judge0 and polls until the run finishes. */
export async function judge0Submit(
  languageId: number,
  source: string
): Promise<Judge0Output> {
  const create = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language_id: languageId,
      source_code: source,
      stdin: "",
      cpu_time_limit: 5,
      memory_limit: 128000,
    }),
  });
  if (!create.ok) {
    throw new Error(`Code runner create failed (HTTP ${create.status}).`);
  }
  const created = (await create.json()) as { token?: string };
  if (!created.token) {
    throw new Error("Code runner returned no token.");
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const res = await fetch(
      `${JUDGE0_URL}/submissions/${created.token}?base64_encoded=false&fields=status_id,stdout,stderr,compile_output`
    );
    if (!res.ok) {
      throw new Error(`Code runner poll failed (HTTP ${res.status}).`);
    }
    const data = (await res.json()) as {
      status_id?: number;
      stdout?: string;
      stderr?: string;
      compile_output?: string;
    };
    const statusId = Number(data.status_id ?? 0);
    if (statusId >= 3) {
      return {
        statusId,
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
        compileOutput: data.compile_output ?? "",
      };
    }
    if (Date.now() > deadline) {
      throw new Error("Code runner timed out waiting for a result.");
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

export interface LanguageTestResult {
  passed: boolean;
  error?: string;
  got?: string;
}

export interface RunCodeInLanguageResult {
  /** true when the execution service itself worked (even if a test failed). */
  ok: boolean;
  /** Set only when the remote service was unavailable or the run failed. */
  serviceError?: string;
  /** One result per test case. */
  tests: LanguageTestResult[];
}

function stringifyValue(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function trim(s: string): string {
  return s.replace(/\s+$/, "").trim();
}

/**
 * Runs a candidate solution in any supported language against hidden test
 * cases. JavaScript runs locally (node:vm, one call per test). Python, C++ and
 * Java run once remotely via Judge0 with a harness that evaluates every test
 * and prints one PASS/FAIL/ERROR line each.
 */
export async function runCodeInLanguage(
  language: CodeLanguage,
  code: string,
  testCases: TestCase[]
): Promise<RunCodeInLanguageResult> {
  if (language === "javascript") {
    return {
      ok: true,
      tests: testCases.map((tc) => {
        const r = runCode(code, tc.args);
        return {
          passed: r.ok && deepEqual(r.result, tc.expected),
          error: r.ok ? undefined : r.error,
          got: r.ok ? stringifyValue(r.result) : undefined,
        };
      }),
    };
  }

  const langId = LANGUAGE_META[language]?.judge0Id ?? null;
  if (langId == null) {
    return {
      ok: false,
      serviceError: `Unsupported language: ${language}`,
      tests: [],
    };
  }

  let source: string;
  try {
    source = buildHarness(language, code, testCases);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: true,
      tests: testCases.map(() => ({ passed: false, error: message })),
    };
  }

  let out: Judge0Output;
  try {
    out = await judge0Submit(langId, source);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, serviceError: message, tests: [] };
  }

  if (out.compileOutput) {
    return {
      ok: true,
      tests: testCases.map(() => ({
        passed: false,
        error: "Compile error:\n" + trim(out.compileOutput),
      })),
    };
  }
  if (out.statusId === 5) {
    return {
      ok: true,
      tests: testCases.map(() => ({
        passed: false,
        error: "Time limit exceeded — possible infinite loop.",
      })),
    };
  }
  if (out.stderr) {
    return {
      ok: true,
      tests: testCases.map(() => ({
        passed: false,
        error: "Runtime error:\n" + trim(out.stderr),
      })),
    };
  }
  if (out.statusId !== 3) {
    return {
      ok: true,
      tests: testCases.map(() => ({
        passed: false,
        error: `Execution failed (status ${out.statusId}).`,
      })),
    };
  }

  const lines = out.stdout
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.length > 0);

  return {
    ok: true,
    tests: testCases.map((_tc, i) => {
      const line = lines[i];
      if (!line) return { passed: false, error: "No output produced." };
      if (line === "PASS") return { passed: true };
      if (line.startsWith("FAIL "))
        return { passed: false, got: line.slice("FAIL ".length) };
      if (line.startsWith("ERROR "))
        return { passed: false, error: line.slice("ERROR ".length) };
      return { passed: false, error: `Unexpected output: ${line}` };
    }),
  };
}
