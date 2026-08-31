"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ASSESSMENT, SECTIONS } from "@/lib/questions";

interface Props {
  code: string;
  invite: {
    name: string;
    email: string;
    role: string | null;
  };
}

export function StartTest({ code, invite }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/attempt/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.push(`/test/${data.attemptId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {ASSESSMENT.title}
        </h1>
        <p className="mt-2 text-slate-500">
          Welcome, {invite.name}. Please review the details below before you begin.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Candidate</dt>
            <dd className="font-medium">{invite.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium">{invite.email}</dd>
          </div>
          {invite.role && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Role</dt>
              <dd className="font-medium">{invite.role}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-500">Time limit</dt>
            <dd className="font-medium">{ASSESSMENT.timeLimitMinutes} minutes</dd>
          </div>
        </dl>

        <div className="mt-6 space-y-3">
          {SECTIONS.map((s, i) => (
            <div
              key={s.id}
              className="flex items-start gap-3 rounded-lg bg-slate-50 p-3"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                {i + 1}
              </div>
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-slate-500">{s.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Once you start, the timer begins and cannot be paused. Do not refresh
          or close the tab — your progress is saved automatically.
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          onClick={start}
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Preparing…" : "Start Assessment"}
        </button>
      </div>
    </main>
  );
}
