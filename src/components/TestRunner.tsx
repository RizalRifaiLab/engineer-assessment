"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { runCodeInBrowser } from "@/lib/browserRunner";
import type {
  CandidateAnswers,
  SanitizedCodingQuestion,
  SanitizedMcqQuestion,
  SanitizedSqlQuestion,
} from "@/lib/types";

interface LoadedData {
  status: string;
  attemptId: string;
  deadlineAt: string;
  timeLimitSeconds: number;
  questions: {
    mcq: SanitizedMcqQuestion[];
    coding: SanitizedCodingQuestion[];
    sql: SanitizedSqlQuestion[];
  };
  savedAnswers: CandidateAnswers;
}

type SectionId = "mcq" | "coding" | "sql";

const SECTION_META: Record<SectionId, { label: string }> = {
  mcq: { label: "Knowledge Quiz" },
  coding: { label: "Live Coding" },
  sql: { label: "SQL" },
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function stringify(v: unknown): string {
  if (v === undefined) return "undefined";
  return JSON.stringify(v);
}

export function TestRunner({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");
  const [section, setSection] = useState<SectionId>("mcq");
  const [answers, setAnswers] = useState<CandidateAnswers>({
    mcq: {},
    coding: {},
    sql: {},
  });
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [runResults, setRunResults] = useState<
    Record<string, { label: string; pass: boolean; out: string; exp: string; error?: string }[]>
  >({});

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submittedRef = useRef(false);

  // Load attempt
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/attempt/${attemptId}`);
        const json = await res.json();
        if (!res.ok) {
          setFatal(json.error || "Could not load assessment.");
          return;
        }
        if (json.status === "submitted" || json.status === "auto_submitted") {
          router.replace(`/result/${attemptId}`);
          return;
        }
        setData(json);
        const saved = json.savedAnswers ?? { mcq: {}, coding: {}, sql: {} };
        // prefill coding editors with starter code when empty
        const coding: Record<string, string> = { ...saved.coding };
        for (const q of json.questions.coding) {
          if (!coding[q.id]) coding[q.id] = q.starterCode;
        }
        setAnswers({ mcq: saved.mcq ?? {}, coding, sql: saved.sql ?? {} });
      } catch {
        setFatal("Network error while loading the assessment.");
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId, router]);

  // Countdown timer
  useEffect(() => {
    if (!data) return;
    const deadline = new Date(data.deadlineAt).getTime();
    const tick = () =>
      setTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [data]);

  // Autosave (debounced)
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => {
      fetch(`/api/attempt/${attemptId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", answers: answersRef.current }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [answers, data, attemptId]);

  async function submit() {
    if (submittedRef.current || !data) return;
    submittedRef.current = true;
    setSubmitting(true);
    const spent = Math.max(0, data.timeLimitSeconds - timeLeft);
    try {
      const res = await fetch(`/api/attempt/${attemptId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          answers: answersRef.current,
          timeSpentSeconds: spent,
        }),
      });
      await res.json();
      router.replace(`/result/${attemptId}`);
    } catch {
      // allow a retry if the network failed
      submittedRef.current = false;
      setSubmitting(false);
    }
  }

  // Auto-submit when the timer hits zero
  useEffect(() => {
    if (data && timeLeft === 0 && !submittedRef.current) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading assessment…
      </div>
    );
  }

  if (fatal || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold text-red-600">Unable to start</p>
        <p className="mt-2 text-slate-500">{fatal || "Assessment not found."}</p>
      </div>
    );
  }

  const { questions } = data;
  const counts: Record<SectionId, number> = {
    mcq: questions.mcq.length,
    coding: questions.coding.length,
    sql: questions.sql.length,
  };
  const answered: Record<SectionId, number> = {
    mcq: questions.mcq.filter((q) => answers.mcq[q.id] !== undefined).length,
    coding: questions.coding.filter(
      (q) => (answers.coding[q.id] || "").trim() !== "" && answers.coding[q.id] !== q.starterCode
    ).length,
    sql: questions.sql.filter((q) => (answers.sql[q.id] || "").trim() !== "").length,
  };

  function setMcq(qid: string, idx: number) {
    setAnswers((a) => ({ ...a, mcq: { ...a.mcq, [qid]: idx } }));
  }
  function setCode(qid: string, code: string) {
    setAnswers((a) => ({ ...a, coding: { ...a.coding, [qid]: code } }));
  }
  function setSql(qid: string, text: string) {
    setAnswers((a) => ({ ...a, sql: { ...a.sql, [qid]: text } }));
  }

  async function runExamples(q: SanitizedCodingQuestion) {
    const code = answers.coding[q.id] || "";
    const results: { label: string; pass: boolean; out: string; exp: string; error?: string }[] = [];
    for (const ex of q.examples) {
      const r = await runCodeInBrowser(code, ex.args);
      const out = r.ok ? stringify(r.result) : "error";
      const exp = stringify(ex.expected);
      results.push({
        label: `solve(${stringify(ex.args)})`,
        pass: r.ok && out === exp,
        out,
        exp,
        error: r.error,
      });
    }
    setRunResults((prev) => ({ ...prev, [q.id]: results }));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <header className="sticky top-0 z-10 -mx-4 mb-6 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Software Engineer Assessment</p>
            <p className="text-xs text-slate-500">Progress is saved automatically</p>
          </div>
          <div
            className={`rounded-lg px-3 py-1.5 font-code text-sm font-bold ${
              timeLeft <= 300
                ? "bg-red-100 text-red-700"
                : "bg-slate-900 text-white"
            }`}
          >
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Section tabs */}
        <div className="mt-3 flex gap-2">
          {(Object.keys(SECTION_META) as SectionId[]).map((sid) => (
            <button
              key={sid}
              onClick={() => setSection(sid)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                section === sid
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {SECTION_META[sid].label}
              <span className="ml-1.5 text-xs opacity-70">
                {answered[sid]}/{counts[sid]}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* MCQ section */}
      {section === "mcq" && (
        <div className="space-y-6">
          {questions.mcq.map((q, i) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold uppercase text-slate-500">
                  {q.category}
                </span>
                <span className="text-xs text-slate-400">
                  {q.points} pts
                </span>
              </div>
              <p className="mb-3 font-medium">
                {i + 1}. {q.prompt}
              </p>
              {q.code && (
                <pre className="mb-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-100">
                  {q.code}
                </pre>
              )}
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                      answers.mcq[q.id] === oi
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers.mcq[q.id] === oi}
                      onChange={() => setMcq(q.id, oi)}
                      className="h-4 w-4 accent-indigo-600"
                    />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coding section */}
      {section === "coding" && (
        <div className="space-y-6">
          {questions.coding.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold uppercase text-indigo-700">
                  {q.difficulty}
                </span>
                <span className="text-xs text-slate-400">{q.points} pts</span>
              </div>
              <h2 className="text-lg font-semibold">{q.title}</h2>
              <p className="mt-1 font-code text-sm text-slate-500">
                {q.signature}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                {q.prompt}
              </p>

              <textarea
                value={answers.coding[q.id] ?? q.starterCode}
                onChange={(e) => setCode(q.id, e.target.value)}
                spellCheck={false}
                rows={8}
                className="font-code mt-4 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200"
              />

              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => runExamples(q)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Run examples
                </button>
                <span className="text-xs text-slate-400">
                  Runs only against the visible examples for instant feedback.
                </span>
              </div>

              {runResults[q.id] && (
                <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3">
                  {runResults[q.id].map((r, ri) => (
                    <div key={ri} className="font-code text-sm">
                      {r.error ? (
                        <p className="text-red-600">
                          ✗ {r.label} → {r.error}
                        </p>
                      ) : r.pass ? (
                        <p className="text-green-700">
                          ✓ {r.label} → {r.out}
                        </p>
                      ) : (
                        <p className="text-red-600">
                          ✗ {r.label} → got {r.out}, expected {r.exp}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SQL section */}
      {section === "sql" && (
        <div className="space-y-6">
          {questions.sql.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold uppercase text-emerald-700">
                  SQL
                </span>
                <span className="text-xs text-slate-400">{q.points} pts</span>
              </div>
              <h2 className="text-lg font-semibold">{q.title}</h2>
              {q.schema && (
                <pre className="font-code mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm text-emerald-200">
                  {q.schema}
                </pre>
              )}
              <p className="mt-3 text-sm text-slate-700">{q.prompt}</p>
              <textarea
                value={answers.sql[q.id] ?? ""}
                onChange={(e) => setSql(q.id, e.target.value)}
                spellCheck={false}
                rows={5}
                placeholder="SELECT ..."
                className="font-code mt-4 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          ))}
        </div>
      )}

      {/* Footer / submit */}
      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-400">
          {answered.mcq + answered.coding + answered.sql} answered across all
          sections.
        </p>
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Assessment"}
        </button>
      </div>
    </div>
  );
}
