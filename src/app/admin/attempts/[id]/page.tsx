import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getAttempt, getInviteById } from "@/lib/db";
import { runCode } from "@/lib/codeRunner";
import { deepEqual } from "@/lib/scoring";
import { ReviewAttempt } from "@/components/ReviewAttempt";
import type {
  CandidateAnswers,
  CodingQuestion,
  McqQuestion,
  SqlQuestion,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { id } = await params;
  const attempt = await getAttempt(id);
  if (!attempt) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        Attempt not found.
      </main>
    );
  }
  const invite = await getInviteById(attempt.invite_id);

  const stored = attempt.answers as {
    questions?: {
      mcq?: McqQuestion[];
      coding?: CodingQuestion[];
      sql?: SqlQuestion[];
    };
    answers?: Partial<CandidateAnswers>;
  };
  const questions = stored.questions ?? { mcq: [], coding: [], sql: [] };
  const answers = stored.answers ?? { mcq: {}, coding: {}, sql: {} };

  const mcq = (questions.mcq ?? []).map((q) => ({
    id: q.id,
    category: q.category,
    prompt: q.prompt,
    code: q.code,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    points: q.points,
    selected: answers.mcq?.[q.id] ?? null,
  }));

  const coding = (questions.coding ?? []).map((q) => {
    const code = answers.coding?.[q.id] ?? "";
    const tests = q.testCases.map((tc) => {
      const r = runCode(code, tc.args);
      const passed = r.ok && deepEqual(r.result, tc.expected);
      return {
        args: JSON.stringify(tc.args),
        expected: JSON.stringify(tc.expected),
        got: r.ok ? JSON.stringify(r.result) : `error: ${r.error}`,
        passed,
      };
    });
    return {
      id: q.id,
      title: q.title,
      difficulty: q.difficulty,
      prompt: q.prompt,
      signature: q.signature,
      points: q.points,
      code,
      tests,
      passed: tests.every((t) => t.passed),
    };
  });

  const sql = (questions.sql ?? []).map((q) => ({
    id: q.id,
    title: q.title,
    schema: q.schema,
    prompt: q.prompt,
    points: q.points,
    answer: answers.sql?.[q.id] ?? "",
  }));

  return (
    <ReviewAttempt
      attempt={{
        id: attempt.id,
        status: attempt.status,
        mcq_score: attempt.mcq_score,
        mcq_total: attempt.mcq_total,
        coding_score: attempt.coding_score,
        coding_total: attempt.coding_total,
        sql_score: attempt.sql_score,
        sql_total: attempt.sql_total,
        total_score: attempt.total_score,
        total_possible: attempt.total_possible,
        time_spent_seconds: attempt.time_spent_seconds,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
        verdict: attempt.verdict,
        notes: attempt.notes,
      }}
      invite={
        invite
          ? {
              candidate_name: invite.candidate_name,
              candidate_email: invite.candidate_email,
              role: invite.role,
            }
          : null
      }
      mcq={mcq}
      coding={coding}
      sql={sql}
    />
  );
}
