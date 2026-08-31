"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  codingAnswered,
  defaultStarter,
  normCodingAnswer,
  starterFor,
} from "@/lib/languages";
import type {
  CandidateAnswers,
  CodeLanguage,
  CodingAnswer,
  SanitizedCodingQuestion,
  SanitizedMcqQuestion,
  SanitizedSqlQuestion,
} from "@/lib/types";
import { CodeEditor } from "./CodeEditor";
import { runSqlQuery, type SqlRunResult } from "@/lib/sqlRunner";

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

function difficultyColor(d: string): string {
  if (d === "Easy") return "bg-green-100 text-green-700";
  if (d === "Medium") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function displayCell(v: string | number | null | undefined): string {
  return v === null || v === undefined ? "NULL" : String(v);
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
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [sqlResults, setSqlResults] = useState<Record<string, SqlRunResult>>({});

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submittedRef = useRef(false);
  const submitRef = useRef<() => void>(() => {});

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
        const deadline = new Date(json.deadlineAt).getTime();
        setTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
        const saved = json.savedAnswers ?? { mcq: {}, coding: {}, sql: {} };
        // prefill coding editors with starter code (in the default language)
        // when the candidate hasn't written anything yet.
        const coding: CandidateAnswers["coding"] = {};
        for (const q of json.questions.coding) {
          const ans = normCodingAnswer(saved.coding[q.id]);
          if (saved.coding?.[q.id]) {
            coding[q.id] = ans;
          } else {
            const def = defaultStarter(q);
            coding[q.id] = { language: def.language, code: def.starterCode };
          }
        }
        setAnswers({ mcq: saved.mcq ?? {}, coding, sql: saved.sql ?? {} });
      } catch {
        setFatal("Network error while loading the assessment.");
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId, router]);

  // Countdown timer. Auto-submits only when the deadline is actually reached —
  // NOT when timeLeft === 0 from state, since that fires immediately on mount.
  useEffect(() => {
    if (!data) return;
    const deadline = new Date(data.deadlineAt).getTime();
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((deadline - Date.now()) / 1000)
      );
      setTimeLeft(remaining);
      if (remaining <= 0 && !submittedRef.current) {
        submitRef.current();
      }
    };
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

  // Keep the timer's auto-submit handler pointing at the latest closure
  useEffect(() => {
    submitRef.current = submit;
  });

  // Auto-submit as soon as every question has an answer (the timer handles the
  // time-expiry case separately above).
  useEffect(() => {
    if (!data) return;
    const { mcq, coding, sql } = data.questions;
    const allMcq = mcq.every((q) => answers.mcq[q.id] !== undefined);
    const allCoding = coding.every((q) =>
      codingAnswered(normCodingAnswer(answers.coding[q.id]), q)
    );
    const allSql = sql.every((q) => (answers.sql[q.id] ?? "").trim() !== "");
    if (allMcq && allCoding && allSql && !submittedRef.current) {
      submitRef.current();
    }
  }, [answers, data]);

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
    coding: questions.coding.filter((q) =>
      codingAnswered(normCodingAnswer(answers.coding[q.id]), q)
    ).length,
    sql: questions.sql.filter((q) => (answers.sql[q.id] || "").trim() !== "").length,
  };

  const allFilled =
    answered.mcq === counts.mcq &&
    answered.coding === counts.coding &&
    answered.sql === counts.sql;

  function setMcq(qid: string, idx: number) {
    setAnswers((a) => ({ ...a, mcq: { ...a.mcq, [qid]: idx } }));
  }
  function setCode(qid: string, code: string) {
    setAnswers((a) => {
      const stored = a.coding[qid]
        ? normCodingAnswer(a.coding[qid])
        : undefined;
      const language = stored?.language ?? "javascript";
      return {
        ...a,
        coding: { ...a.coding, [qid]: { language, code } },
      };
    });
  }
  function setLanguage(qid: string, language: CodeLanguage) {
    setAnswers((a) => {
      const q = data?.questions.coding.find((x) => x.id === qid);
      if (!q) return a;
      const old = a.coding[qid] ? normCodingAnswer(a.coding[qid]) : null;
      const oldStarter = old ? starterFor(q, old.language) : null;
      const newStarter = starterFor(q, language);
      // If the candidate never touched the code, swap in the new starter so
      // the signature stays correct for the chosen language.
      const untouched = oldStarter
        ? old?.code.trim() === oldStarter.starterCode.trim()
        : true;
      const code =
        untouched && newStarter ? newStarter.starterCode : old?.code ?? "";
      return {
        ...a,
        coding: { ...a.coding, [qid]: { language, code } },
      };
    });
  }
  function setSql(qid: string, text: string) {
    setAnswers((a) => ({ ...a, sql: { ...a.sql, [qid]: text } }));
  }

  /** Reset a coding question back to the starter for its current language. */
  function resetCode(qid: string) {
    setAnswers((a) => {
      const q = data?.questions.coding.find((x) => x.id === qid);
      if (!q) return a;
      const cur = a.coding[qid] ? normCodingAnswer(a.coding[qid]) : null;
      const lang = cur?.language ?? defaultStarter(q).language;
      const starter = starterFor(q, lang);
      return {
        ...a,
        coding: {
          ...a.coding,
          [qid]: { language: lang, code: starter ? starter.starterCode : "" },
        },
      };
    });
  }

  /** Run the candidate's SQL against the question's sample data. */
  function runSql(qid: string) {
    const q = data?.questions.sql.find((x) => x.id === qid);
    if (!q) return;
    const result = runSqlQuery(q.sampleData, answers.sql[qid] ?? "");
    setSqlResults((prev) => ({ ...prev, [qid]: result }));
  }

  /** The candidate's current answer for a coding question (or the starter). */
  function currentAnswer(q: SanitizedCodingQuestion): CodingAnswer {
    return answers.coding[q.id]
      ? normCodingAnswer(answers.coding[q.id])
      : { language: defaultStarter(q).language, code: defaultStarter(q).starterCode };
  }

  function formatCall(args: unknown[]): string {
    return args.length === 1
      ? `solve(${stringify(args[0])})`
      : `solve(${stringify(args)})`;
  }

  /** Compare outputs ignoring whitespace (Judge0 prints "[0, 1]" vs JS "[0,1]"). */
  function sameOutput(a: string, b: string): boolean {
    return a.replace(/\s+/g, "") === b.replace(/\s+/g, "");
  }

  async function runExamples(q: SanitizedCodingQuestion) {
    setRunning((prev) => ({ ...prev, [q.id]: true }));
    const ans = currentAnswer(q);
    const results: { label: string; pass: boolean; out: string; exp: string; error?: string }[] = [];
    try {
      for (const ex of q.examples) {
        let ok = false;
        let out = "";
        let error: string | undefined;
        try {
          const res = await fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              language: ans.language,
              code: ans.code,
              args: ex.args,
            }),
          });
          const data = await res.json();
          ok = data.ok === true;
          out = data.output ?? "";
          error = data.error;
        } catch {
          error = "Network error while running your code.";
        }
        const exp = stringify(ex.expected);
        results.push({
          label: formatCall(ex.args),
          pass: ok && sameOutput(out, exp),
          out,
          exp,
          error,
        });
      }
    } finally {
      setRunResults((prev) => ({ ...prev, [q.id]: results }));
      setRunning((prev) => ({ ...prev, [q.id]: false }));
    }
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
          {questions.coding.map((q) => {
            const ans = currentAnswer(q);
            const starter = starterFor(q, ans.language);
            return (
              <div
                key={q.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${difficultyColor(q.difficulty)}`}
                    >
                      {q.difficulty}
                    </span>
                    <h2 className="text-base font-semibold">{q.title}</h2>
                    <span className="text-xs text-slate-400">{q.points} pts</span>
                  </div>
                </div>

                <div className="grid divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                  {/* Problem pane */}
                  <div className="p-4">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {q.prompt}
                    </p>
                    {q.examples.map((ex, i) => (
                      <div key={i} className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Example {i + 1}
                        </p>
                        <div className="mt-1 space-y-1">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <span className="mr-2 text-xs font-semibold text-slate-500">
                              Input
                            </span>
                            <span className="font-code text-sm text-slate-800">
                              {formatCall(ex.args)}
                            </span>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <span className="mr-2 text-xs font-semibold text-slate-500">
                              Output
                            </span>
                            <span className="font-code text-sm text-slate-800">
                              {stringify(ex.expected)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Editor pane */}
                  <div className="flex flex-col p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Language</span>
                        <select
                          value={ans.language}
                          onChange={(e) =>
                            setLanguage(q.id, e.target.value as CodeLanguage)
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
                        >
                          {q.languages.map((l) => (
                            <option key={l.language} value={l.language}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={() => resetCode(q.id)}
                        title="Restore the starter code for the selected language"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        Reset
                      </button>
                    </div>
                    <p className="font-code mb-2 text-xs text-slate-400">
                      {starter?.signature ?? ans.language}
                    </p>
                    <CodeEditor
                      value={ans.code}
                      onChange={(v) => setCode(q.id, v)}
                      ariaLabel={`Code for ${q.title}`}
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => runExamples(q)}
                        disabled={!!running[q.id]}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        {running[q.id] ? "Running…" : "Run code"}
                      </button>
                      <span className="text-xs text-slate-400">
                        Runs the examples in {ans.language} for instant feedback.
                      </span>
                    </div>

                    {runResults[q.id] && (
                      <div className="mt-3 rounded-lg bg-slate-900 p-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Output
                        </p>
                        <div className="space-y-1">
                          {runResults[q.id].map((r, ri) => (
                            <div key={ri} className="font-code text-sm">
                              {r.error ? (
                                <p className="text-red-400">
                                  ✗ {r.label} → {r.error}
                                </p>
                              ) : r.pass ? (
                                <p className="text-green-400">
                                  ✓ {r.label} → {r.out}
                                </p>
                              ) : (
                                <p className="text-red-400">
                                  ✗ {r.label} → got {r.out}, expected {r.exp}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SQL section */}
      {section === "sql" && (
        <div className="space-y-6">
          {questions.sql.map((q) => {
            const result = sqlResults[q.id];
            return (
              <div
                key={q.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold uppercase text-emerald-700">
                      SQL
                    </span>
                    <h2 className="text-base font-semibold">{q.title}</h2>
                    <span className="text-xs text-slate-400">{q.points} pts</span>
                  </div>
                </div>

                <div className="grid divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                  {/* Problem + sample data pane */}
                  <div className="p-4">
                    {q.schema && (
                      <pre className="font-code overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm text-emerald-200">
                        {q.schema}
                      </pre>
                    )}
                    <p className="mt-3 text-sm text-slate-700">{q.prompt}</p>

                    {q.sampleData?.map((t) => (
                      <div key={t.name} className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Table: {t.name}
                        </p>
                        <div className="mt-1 overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="bg-slate-50">
                                {t.columns.map((c) => (
                                  <th
                                    key={c.name}
                                    className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-600"
                                  >
                                    {c.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {t.rows.map((row, ri) => (
                                <tr
                                  key={ri}
                                  className={ri % 2 ? "bg-slate-50/50" : ""}
                                >
                                  {row.map((cell, ci) => (
                                    <td
                                      key={ci}
                                      className="font-code border-b border-slate-100 px-3 py-1.5 text-xs text-slate-700"
                                    >
                                      {displayCell(cell)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Query editor + output pane */}
                  <div className="flex flex-col p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Your query
                      </span>
                      <button
                        onClick={() => runSql(q.id)}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                      >
                        Run
                      </button>
                    </div>
                    <CodeEditor
                      value={answers.sql[q.id] ?? ""}
                      onChange={(v) => setSql(q.id, v)}
                      minRows={6}
                      placeholder="SELECT ..."
                      ariaLabel={`SQL for ${q.title}`}
                    />

                    {result && (
                      <div className="mt-3 rounded-lg bg-slate-900 p-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Output
                        </p>
                        {result.ok ? (
                          result.columns.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                <thead>
                                  <tr>
                                    {result.columns.map((c) => (
                                      <th
                                        key={c}
                                        className="px-2 py-1 font-semibold text-emerald-200"
                                      >
                                        {c}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {result.rows.map((row, ri) => (
                                    <tr key={ri}>
                                      {result.columns.map((c) => (
                                        <td
                                          key={c}
                                          className="font-code px-2 py-1 text-xs text-slate-200"
                                        >
                                          {displayCell(row[c])}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="font-code text-xs text-slate-400">
                              Query ran — no rows returned.
                            </p>
                          )
                        ) : (
                          <p className="font-code text-sm text-red-400">
                            ✗ {result.error}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer / submit */}
      <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-slate-400">
            {answered.mcq + answered.coding + answered.sql} of{" "}
            {counts.mcq + counts.coding + counts.sql} questions answered.
          </p>
          {!allFilled && timeLeft > 0 && (
            <p className="mt-1 text-xs font-medium text-amber-600">
              Answer all questions to submit — or the assessment submits
              automatically when the timer runs out.
            </p>
          )}
        </div>
        <button
          onClick={submit}
          disabled={submitting || (!allFilled && timeLeft > 0)}
          className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "Submit Assessment"}
        </button>
      </div>

      {/* Submitting overlay */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-900/70">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          <p className="font-semibold text-white">Submitting your assessment…</p>
        </div>
      )}
    </div>
  );
}
