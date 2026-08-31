import { NextResponse } from "next/server";
import { judge0Submit, runCode } from "@/lib/codeRunner";
import { buildRunHarness } from "@/lib/harness";
import { LANGUAGE_META, isCodeLanguage } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Instant preview runner used by the candidate's "Run examples" button.
 * Runs a single call to `solve` in the chosen language and returns the printed
 * output. JavaScript executes locally in the vm sandbox; Python/C++/Java run
 * remotely via Judge0. This is preview-only — authoritative grading happens on
 * the attempt submit route.
 */
export async function POST(req: Request) {
  let body: { language?: unknown; code?: unknown; args?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 }
    );
  }

  const language = isCodeLanguage(body.language) ? body.language : "javascript";
  const code = typeof body.code === "string" ? body.code : "";
  const args = Array.isArray(body.args) ? body.args : [];

  if (code.trim() === "") {
    return NextResponse.json({ ok: false, error: "No code to run." });
  }

  if (language === "javascript") {
    const r = runCode(code, args);
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: r.error });
    }
    let output: string;
    try {
      output =
        r.result === undefined ? "undefined" : JSON.stringify(r.result);
    } catch {
      output = String(r.result);
    }
    return NextResponse.json({ ok: true, output });
  }

  const langId = LANGUAGE_META[language]?.judge0Id ?? null;
  if (langId == null) {
    return NextResponse.json({ ok: false, error: "Unsupported language." });
  }

  let source: string;
  try {
    source = buildRunHarness(language, code, args);
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  let out;
  try {
    out = await judge0Submit(langId, source);
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: "Code runner unavailable: " +
        (e instanceof Error ? e.message : String(e)),
    });
  }

  if (out.compileOutput) {
    return NextResponse.json({
      ok: false,
      error: "Compile error:\n" + out.compileOutput.trim(),
    });
  }
  if (out.statusId === 5) {
    return NextResponse.json({
      ok: false,
      error: "Time limit exceeded — possible infinite loop.",
    });
  }
  if (out.stderr) {
    return NextResponse.json({
      ok: false,
      error: "Runtime error:\n" + out.stderr.trim(),
    });
  }
  if (out.statusId !== 3) {
    return NextResponse.json({
      ok: false,
      error: `Execution failed (status ${out.statusId}).`,
    });
  }

  const line = out.stdout
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .find((l) => l.length > 0);

  if (line == null) {
    return NextResponse.json({ ok: false, error: "No output produced." });
  }
  if (line.startsWith("ERROR ")) {
    return NextResponse.json({
      ok: false,
      error: line.slice("ERROR ".length),
    });
  }
  return NextResponse.json({ ok: true, output: line });
}
