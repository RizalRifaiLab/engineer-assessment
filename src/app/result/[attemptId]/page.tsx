import Link from "next/link";
import { getAttempt, getInviteById } from "@/lib/db";
import { ASSESSMENT } from "@/lib/questions";

export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  let attempt = null;
  let invite = null;
  try {
    attempt = await getAttempt(attemptId);
    if (attempt) invite = await getInviteById(attempt.invite_id);
  } catch {
    attempt = null;
  }

  if (!attempt) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold">Result not found</h1>
        <Link href="/" className="mt-4 text-indigo-600 hover:underline">
          Back to home
        </Link>
      </main>
    );
  }

  const autoTotal = attempt.mcq_total + attempt.coding_total;
  const autoScore = attempt.mcq_score + attempt.coding_score;
  const autoPct = autoTotal > 0 ? Math.round((autoScore / autoTotal) * 100) : 0;
  const submitted = attempt.status === "submitted" || attempt.status === "auto_submitted";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
          ✓
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Thank you</h1>
        <p className="mt-2 text-slate-500">
          {invite ? `Your assessment has been recorded, ${invite.candidate_name}.` : "Your assessment has been recorded."}
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {submitted ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Your score (auto-graded sections)
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold">{autoScore}</span>
              <span className="text-lg text-slate-400">/ {autoTotal}</span>
              <span className="ml-auto rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                {autoPct}%
              </span>
            </div>

            <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Knowledge Quiz</dt>
                <dd className="font-medium">
                  {attempt.mcq_score} / {attempt.mcq_total}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Live Coding</dt>
                <dd className="font-medium">
                  {attempt.coding_score} / {attempt.coding_total}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">SQL (manual review)</dt>
                <dd className="font-medium text-slate-400">pending review</dd>
              </div>
            </dl>

            <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
              Your SQL answers are reviewed manually. Your recruiter will be in
              touch with the final result.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            This attempt is still in progress. Please return to the test to
            finish it.
          </p>
        )}
      </div>

      <div className="mt-6 text-center text-sm text-slate-400">
        You may close this window.
      </div>
    </main>
  );
}
