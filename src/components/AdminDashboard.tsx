"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InviteWithAttempt } from "@/lib/db";

interface CreatedInvite {
  code: string;
  candidate_name: string;
  candidate_email: string;
}

export function AdminDashboard({
  initialInvites,
  dbError,
}: {
  initialInvites: InviteWithAttempt[];
  dbError: string | null;
}) {
  const router = useRouter();
  const [invites, setInvites] = useState<InviteWithAttempt[]>(initialInvites);
  const [text, setText] = useState("");
  const [attemptsAllowed, setAttemptsAllowed] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedInvite[]>([]);
  const [settingUp, setSettingUp] = useState(false);

  function parseCandidates(raw: string) {
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line
          .split(/[,;\t]+/)
          .map((p) => p.trim())
          .filter(Boolean);
        return {
          name: parts[0] || "",
          email: parts[1] || "",
          role: parts[2] || "",
        };
      })
      .filter((c) => c.name && c.email);
  }

  async function createInvites() {
    setCreating(true);
    setError("");
    setCreated([]);
    const candidates = parseCandidates(text);
    if (candidates.length === 0) {
      setError("Add at least one candidate as: Name, email, role (role optional).");
      setCreating(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates, attemptsAllowed, expiresInDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create invites.");
        return;
      }
      setCreated(data.invites);
      setText("");
      const list = await fetch("/api/admin/invites").then((r) => r.json());
      setInvites(list.invites ?? []);
    } catch {
      setError("Network error.");
    } finally {
      setCreating(false);
    }
  }

  async function setupDb() {
    setSettingUp(true);
    try {
      const res = await fetch("/api/setup");
      const data = await res.json();
      if (res.ok) {
        router.refresh();
      } else {
        setError(data.error || "Setup failed.");
      }
    } catch {
      setError("Network error during setup.");
    } finally {
      setSettingUp(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recruitment Dashboard</h1>
          <p className="text-sm text-slate-500">Manage invites and review candidates.</p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Sign out
        </button>
      </header>

      {dbError && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Database is not ready</p>
          <p className="mt-1 text-sm text-amber-800">
            The database connection failed. If this is a fresh deployment, click
            the button below to create the tables once.
          </p>
          <button
            onClick={setupDb}
            disabled={settingUp}
            className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {settingUp ? "Setting up…" : "Initialize database"}
          </button>
        </div>
      )}

      {/* Create invites */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold">Create invite codes</h2>
        <p className="mt-1 text-sm text-slate-500">
          One candidate per line:{" "}
          <span className="font-code">Name, email@example.com, Role</span> (role optional).
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={"Jane Doe, jane@company.com, Backend\nJohn Smith, john@company.com"}
          className="font-code mt-3 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Attempts allowed</span>
            <input
              type="number"
              min={1}
              max={10}
              value={attemptsAllowed}
              onChange={(e) => setAttemptsAllowed(parseInt(e.target.value) || 1)}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Expires in (days)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 7)}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </label>
          <button
            onClick={createInvites}
            disabled={creating}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Generate invites"}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {created.length > 0 && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">
              Invites created — send each link to the matching candidate:
            </p>
            <ul className="mt-2 space-y-2">
              {created.map((c) => (
                <li
                  key={c.code}
                  className="flex items-center justify-between gap-3 rounded-md bg-white p-2 text-sm"
                >
                  <span className="font-medium">
                    {c.candidate_name}{" "}
                    <span className="text-slate-400">({c.candidate_email})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-code font-bold">{c.code}</span>
                    <a
                      href={`${origin}/t/${c.code}`}
                      className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
                    >
                      Copy link
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Invites table */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold">Candidates</h2>
        </div>
        {invites.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-400">
            No invites yet. Create your first invite above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3">Candidate</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Auto score</th>
                  <th className="px-6 py-3">SQL</th>
                  <th className="px-6 py-3">Verdict</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const autoScore =
                    (inv.mcq_score ?? 0) + (inv.coding_score ?? 0);
                  const autoTotal =
                    (inv.mcq_total ?? 0) + (inv.coding_total ?? 0);
                  const inProgress =
                    inv.attempt_status === "in_progress";
                  const timedOut =
                    inProgress &&
                    !!inv.deadline_at &&
                    new Date(inv.deadline_at) < new Date();
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-slate-50 hover:bg-slate-50"
                    >
                      <td className="px-6 py-3">
                        <p className="font-medium">{inv.candidate_name}</p>
                        <p className="text-xs text-slate-400">
                          {inv.candidate_email}
                        </p>
                        <p className="font-code mt-0.5 text-xs text-slate-400">
                          {inv.code}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-slate-500">
                        {inv.role || "—"}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge
                          hasAttempt={!!inv.attempt_id}
                          attemptStatus={inv.attempt_status}
                          inviteStatus={inv.status}
                          timedOut={timedOut}
                        />
                      </td>
                      <td className="px-6 py-3 font-code">
                        {inv.attempt_id ? `${autoScore}/${autoTotal}` : "—"}
                      </td>
                      <td className="px-6 py-3 font-code">
                        {inv.sql_score === null
                          ? inv.attempt_id
                            ? "pending"
                            : "—"
                          : `${inv.sql_score}/${inv.sql_total ?? 0}`}
                      </td>
                      <td className="px-6 py-3">
                        <VerdictBadge verdict={inv.verdict} />
                      </td>
                      <td className="px-6 py-3 text-right">
                        {inv.attempt_id && (
                          <Link
                            href={`/admin/attempts/${inv.attempt_id}`}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
                          >
                            Review
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusBadge({
  hasAttempt,
  attemptStatus,
  inviteStatus,
  timedOut,
}: {
  hasAttempt: boolean;
  attemptStatus: string | null;
  inviteStatus: string;
  timedOut: boolean;
}) {
  if (!hasAttempt) {
    const used = inviteStatus === "completed";
    return (
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
          used ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-700"
        }`}
      >
        {used ? "Completed" : "Not started"}
      </span>
    );
  }
  if (attemptStatus === "in_progress") {
    return timedOut ? (
      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        Timed out
      </span>
    ) : (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        In progress
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
      Submitted
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-slate-300">—</span>;
  const styles: Record<string, string> = {
    pass: "bg-green-100 text-green-800",
    fail: "bg-red-100 text-red-700",
    review: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[verdict] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {verdict}
    </span>
  );
}
