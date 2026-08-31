"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AttemptSummary {
  id: string;
  status: string;
  mcq_score: number;
  mcq_total: number;
  coding_score: number;
  coding_total: number;
  sql_score: number | null;
  sql_total: number;
  total_score: number | null;
  total_possible: number;
  time_spent_seconds: number;
  started_at: string;
  submitted_at: string | null;
  verdict: string | null;
  notes: string | null;
}

interface InviteSummary {
  candidate_name: string;
  candidate_email: string;
  role: string | null;
}

interface McqReview {
  id: string;
  category: string;
  prompt: string;
  code?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  points: number;
  selected: number | null;
}

interface CodingReview {
  id: string;
  title: string;
  difficulty: string;
  prompt: string;
  signature: string;
  points: number;
  code: string;
  tests: { args: string; expected: string; got: string; passed: boolean }[];
  passed: boolean;
}

interface SqlReview {
  id: string;
  title: string;
  schema?: string;
  prompt: string;
  points: number;
  answer: string;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function ReviewAttempt({
  attempt,
  invite,
  mcq,
  coding,
  sql,
}: {
  attempt: AttemptSummary;
  invite: InviteSummary | null;
  mcq: McqReview[];
  coding: CodingReview[];
  sql: SqlReview[];
}) {
  const router = useRouter();
  const [sqlScore, setSqlScore] = useState<number | "">(
    attempt.sql_score ?? ""
  );
  const [verdict, setVerdict] = useState(attempt.verdict ?? "review");
  const [notes, setNotes] = useState(attempt.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSqlScore(attempt.sql_score ?? "");
    setVerdict(attempt.verdict ?? "review");
    setNotes(attempt.notes ?? "");
  }, [attempt.sql_score, attempt.verdict, attempt.notes]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/attempts/${attempt.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sqlScore: sqlScore === "" ? null : sqlScore,
          verdict: verdict || null,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  const autoScore = attempt.mcq_score + attempt.coding_score;
  const autoTotal = attempt.mcq_total + attempt.coding_total;
  const autoPct = autoTotal ? Math.round((autoScore / autoTotal) * 100) : 0;
  const finalScore =
    attempt.total_score !== null ? attempt.total_score : autoScore;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/admin"
        className="text-sm text-indigo-600 hover:underline"
      >
        ← Back to dashboard
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {invite?.candidate_name ?? "Candidate"}
          </h1>
          <p className="text-sm text-slate-500">
            {invite?.candidate_email}
            {invite?.role ? ` · ${invite.role}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Started {fmtDate(attempt.started_at)} · Submitted{" "}
            {fmtDate(attempt.submitted_at)} · Took{" "}
            {formatDuration(attempt.time_spent_seconds)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Final score
          </p>
          <p className="text-3xl font-bold">
            {finalScore}
            <span className="text-base font-normal text-slate-400">
              {" "}
              / {attempt.total_possible}
            </span>
          </p>
        </div>
      </header>

      {/* Score summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Knowledge" value={`${attempt.mcq_score}/${attempt.mcq_total}`} />
        <Stat label="Coding" value={`${attempt.coding_score}/${attempt.coding_total}`} />
        <Stat
          label="SQL (manual)"
          value={
            attempt.sql_score === null
              ? "—"
              : `${attempt.sql_score}/${attempt.sql_total}`
          }
        />
        <Stat label="Auto score" value={`${autoScore}/${autoTotal} (${autoPct}%)`} />
      </div>

      {/* Review form */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Review & verdict</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">
              SQL score (0–{attempt.sql_total})
            </span>
            <input
              type="number"
              min={0}
              max={attempt.sql_total}
              value={sqlScore}
              onChange={(e) =>
                setSqlScore(
                  e.target.value === "" ? "" : parseInt(e.target.value)
                )
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Verdict</span>
            <select
              value={verdict}
              onChange={(e) => setVerdict(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="review">Review</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              onClick={save}
              disabled={saving}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save review"}
            </button>
          </div>
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-slate-500">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Internal notes about this candidate…"
            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-indigo-500"
          />
        </label>
        {saved && (
          <p className="mt-2 text-sm font-medium text-green-700">
            ✓ Review saved.
          </p>
        )}
      </section>

      {/* MCQ answers */}
      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Knowledge Quiz</h2>
        <div className="space-y-3">
          {mcq.map((q, i) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="font-medium">
                {i + 1}. {q.prompt}{" "}
                <span className="ml-1 text-xs text-slate-400">
                  ({q.points} pts)
                </span>
              </p>
              {q.code && (
                <pre className="font-code mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-100">
                  {q.code}
                </pre>
              )}
              <div className="mt-3 space-y-1.5">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correctIndex;
                  const isSelected = oi === q.selected;
                  let cls = "border-slate-200";
                  if (isCorrect) cls = "border-green-400 bg-green-50";
                  else if (isSelected && !isCorrect)
                    cls = "border-red-300 bg-red-50";
                  return (
                    <div
                      key={oi}
                      className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${cls}`}
                    >
                      {isCorrect && <span className="text-green-600">✓</span>}
                      {isSelected && !isCorrect && (
                        <span className="text-red-500">✗</span>
                      )}
                      {!isCorrect && !isSelected && (
                        <span className="text-slate-300">○</span>
                      )}
                      <span>{opt}</span>
                      {isSelected && (
                        <span className="ml-auto text-xs font-semibold text-slate-400">
                          selected
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {q.selected !== null && q.selected !== q.correctIndex && (
                <p className="mt-2 text-xs text-slate-500">
                  <span className="font-semibold">Why:</span> {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Coding answers */}
      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Live Coding</h2>
        <div className="space-y-3">
          {coding.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{q.title}</h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    q.passed
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {q.passed ? "Passed" : "Failed"}
                </span>
              </div>
              <p className="mt-1 font-code text-xs text-slate-400">
                {q.signature} · {q.points} pts
              </p>
              <pre className="font-code mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-100">
                {q.code || "// no code submitted"}
              </pre>
              <div className="mt-3 space-y-1">
                {q.tests.map((t, ti) => (
                  <p
                    key={ti}
                    className={`font-code text-xs ${
                      t.passed ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {t.passed ? "✓" : "✗"} solve({t.args}) → got {t.got},
                    expected {t.expected}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SQL answers */}
      <section className="mt-6">
        <h2 className="mb-3 font-semibold">SQL</h2>
        <div className="space-y-3">
          {sql.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="font-semibold">
                {q.title}{" "}
                <span className="ml-1 text-xs font-normal text-slate-400">
                  ({q.points} pts)
                </span>
              </h3>
              {q.schema && (
                <pre className="font-code mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm text-emerald-200">
                  {q.schema}
                </pre>
              )}
              <p className="mt-2 text-sm text-slate-600">{q.prompt}</p>
              <pre className="font-code mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                {q.answer || "— no answer —"}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
