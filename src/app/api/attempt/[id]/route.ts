import { NextResponse } from "next/server";
import { ASSESSMENT } from "@/lib/questions";
import { gradeAnswers, sanitizeQuestions } from "@/lib/scoring";
import {
  countSubmittedAttempts,
  finalizeAttempt,
  getAttempt,
  getInviteById,
  saveAttemptAnswers,
  updateInviteStatus,
} from "@/lib/db";
import type {
  CandidateAnswers,
  CodingQuestion,
  McqQuestion,
  SqlQuestion,
} from "@/lib/types";

export const runtime = "nodejs";

interface StoredQuestions {
  mcq: McqQuestion[];
  coding: CodingQuestion[];
  sql: SqlQuestion[];
}

function readQuestions(answers: Record<string, unknown>): StoredQuestions {
  const q = (answers.questions ?? {}) as Partial<StoredQuestions>;
  return { mcq: q.mcq ?? [], coding: q.coding ?? [], sql: q.sql ?? [] };
}

function readSaved(answers: Record<string, unknown>): CandidateAnswers {
  const a = (answers.answers ?? {}) as Partial<CandidateAnswers>;
  return { mcq: a.mcq ?? {}, coding: a.coding ?? {}, sql: a.sql ?? {} };
}

function emptyAnswers(): CandidateAnswers {
  return { mcq: {}, coding: {}, sql: {} };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const attempt = await getAttempt(id);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }

  const questions = readQuestions(attempt.answers);
  return NextResponse.json({
    status: attempt.status,
    attemptId: attempt.id,
    deadlineAt: attempt.deadline_at,
    startedAt: attempt.started_at,
    timeLimitSeconds: ASSESSMENT.timeLimitMinutes * 60,
    questions: {
      mcq: sanitizeQuestions(questions.mcq),
      coding: sanitizeQuestions(questions.coding),
      sql: sanitizeQuestions(questions.sql),
    },
    savedAnswers: readSaved(attempt.answers),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const attempt = await getAttempt(id);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  }

  let body: {
    action?: string;
    answers?: CandidateAnswers;
    timeSpentSeconds?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.action === "save") {
    await saveAttemptAnswers(id, body.answers ?? emptyAnswers());
    return NextResponse.json({ ok: true });
  }

  if (body.action === "submit") {
    if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
      return NextResponse.json({ alreadySubmitted: true, attemptId: id });
    }

    const questions = readQuestions(attempt.answers);
    const answers = body.answers ?? emptyAnswers();
    const graded = gradeAnswers(questions, answers);

    await finalizeAttempt(id, {
      mcqScore: graded.breakdown.mcqScore,
      mcqTotal: graded.breakdown.mcqTotal,
      codingScore: graded.breakdown.codingScore,
      codingTotal: graded.breakdown.codingTotal,
      sqlTotal: graded.breakdown.sqlTotal,
      totalPossible: graded.breakdown.totalPossible,
      answers,
      timeSpentSeconds: body.timeSpentSeconds ?? 0,
    });

    const invite = await getInviteById(attempt.invite_id);
    if (invite) {
      const used = await countSubmittedAttempts(invite.id);
      await updateInviteStatus(
        invite.id,
        used >= invite.attempts_allowed ? "completed" : "unused"
      );
    }

    return NextResponse.json({
      submitted: true,
      attemptId: id,
      breakdown: graded.breakdown,
      passingPercent: ASSESSMENT.passingPercent,
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
