import { runInNewContext } from "node:vm";

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
