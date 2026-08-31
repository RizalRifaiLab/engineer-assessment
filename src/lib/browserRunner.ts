import type { RunResult } from "./codeRunner";

/**
 * Client-side preview runner. Executes candidate code in a Web Worker so an
 * infinite loop can't freeze the tab, and terminates on timeout. Used only for
 * instant feedback on the example cases; authoritative grading happens on the
 * server.
 */
export function runCodeInBrowser(code: string, args: unknown[]): Promise<RunResult> {
  return new Promise((resolve) => {
    const workerSrc = `
      self.onmessage = function (e) {
        var code = e.data.code;
        var args = e.data.args;
        var result;
        var error;
        try {
          var factory = new Function(code + "\\n; return (typeof solve === 'function') ? solve : undefined;");
          var solve = factory();
          if (typeof solve !== 'function') {
            error = "Your code must define a function named 'solve'.";
          } else {
            result = solve.apply(null, args);
          }
        } catch (err) {
          error = (err && err.message) ? err.message : String(err);
        }
        var json;
        try {
          json = (result === undefined) ? "undefined" : JSON.stringify(result);
        } catch (err) {
          error = "Result could not be serialized: " + String(err);
          json = null;
        }
        self.postMessage({ json: json, error: error });
      };
    `;

    let blobUrl: string;
    try {
      blobUrl = URL.createObjectURL(
        new Blob([workerSrc], { type: "text/javascript" })
      );
    } catch {
      resolve({ ok: false, error: "Browser preview unavailable." });
      return;
    }

    let settled = false;
    const finish = (r: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(blobUrl);
      resolve(r);
    };

    const worker = new Worker(blobUrl);
    const timer = setTimeout(() => {
      worker.terminate();
      finish({ ok: false, error: "Timed out — possible infinite loop." });
    }, 3000);

    worker.onmessage = (e: MessageEvent<{ json: string; error?: string }>) => {
      const { json, error } = e.data;
      worker.terminate();
      if (error) {
        finish({ ok: false, error });
        return;
      }
      let result: unknown;
      if (json === "undefined") {
        result = undefined;
      } else {
        try {
          result = JSON.parse(json);
        } catch {
          result = json;
        }
      }
      finish({ ok: true, result });
    };

    worker.onerror = (e: ErrorEvent) => {
      worker.terminate();
      finish({ ok: false, error: e.message || "Worker error." });
    };

    worker.postMessage({ code, args });
  });
}
