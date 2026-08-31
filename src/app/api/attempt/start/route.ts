import { NextResponse } from "next/server";
import { ASSESSMENT, buildQuestionSet } from "@/lib/questions";
import { sanitizeQuestions } from "@/lib/scoring";
import {
  countSubmittedAttempts,
  createAttempt,
  getInviteByCode,
  updateInviteStatus,
} from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const code = (body.code || "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Invite code is required." }, { status: 400 });
  }

  const invite = await getInviteByCode(code);
  if (!invite) {
    return NextResponse.json({ error: "Invalid invite code." }, { status: 400 });
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired." }, { status: 400 });
  }
  if (invite.status === "completed") {
    return NextResponse.json(
      { error: "This invite has already been fully used." },
      { status: 400 }
    );
  }

  const used = await countSubmittedAttempts(invite.id);
  if (used >= invite.attempts_allowed) {
    return NextResponse.json(
      { error: "No attempts remaining for this invite." },
      { status: 400 }
    );
  }

  const questions = buildQuestionSet();
  const timeLimitSeconds = ASSESSMENT.timeLimitMinutes * 60;
  const deadlineAt = new Date(Date.now() + timeLimitSeconds * 1000);
  const attempt = await createAttempt(invite.id, deadlineAt, questions);
  await updateInviteStatus(invite.id, "in_progress");

  return NextResponse.json({
    attemptId: attempt.id,
    candidate: {
      name: invite.candidate_name,
      email: invite.candidate_email,
      role: invite.role,
    },
    timeLimitSeconds,
    deadlineAt: deadlineAt.toISOString(),
    questions: {
      mcq: sanitizeQuestions(questions.mcq),
      coding: sanitizeQuestions(questions.coding),
      sql: sanitizeQuestions(questions.sql),
    },
  });
}
