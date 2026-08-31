import { sql } from "@vercel/postgres";
import { randomBytes, randomUUID } from "node:crypto";
import type { CandidateAnswers } from "./types";

// --- Types ---

export interface InviteRow {
  id: number;
  code: string;
  candidate_name: string;
  candidate_email: string;
  role: string | null;
  status: string;
  attempts_allowed: number;
  expires_at: string | null;
  created_at: string;
}

export interface AttemptRow {
  id: string;
  invite_id: number;
  started_at: string;
  submitted_at: string | null;
  deadline_at: string;
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
  verdict: string | null;
  notes: string | null;
  answers: Record<string, unknown>;
}

export interface InviteWithAttempt extends InviteRow {
  attempt_id: string | null;
  attempt_status: string | null;
  mcq_score: number | null;
  mcq_total: number | null;
  coding_score: number | null;
  coding_total: number | null;
  sql_score: number | null;
  sql_total: number | null;
  total_score: number | null;
  total_possible: number | null;
  verdict: string | null;
  started_at: string | null;
  submitted_at: string | null;
  deadline_at: string | null;
}

// --- Helpers ---

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function jsonb(v: unknown): string {
  return JSON.stringify(v);
}

// --- Invites ---

export async function createInvites(
  candidates: { name: string; email: string; role?: string }[],
  opts: { attemptsAllowed: number; expiresInDays: number }
): Promise<InviteRow[]> {
  const expiresAt = new Date(Date.now() + opts.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const created: InviteRow[] = [];
  for (const c of candidates) {
    const code = generateCode();
    const res = await sql`
      INSERT INTO invites (code, candidate_name, candidate_email, role, attempts_allowed, expires_at)
      VALUES (${code}, ${c.name}, ${c.email}, ${c.role ?? null}, ${opts.attemptsAllowed}, ${expiresAt})
      RETURNING *
    `;
    created.push(res.rows[0] as InviteRow);
  }
  return created;
}

export async function getInviteByCode(code: string): Promise<InviteRow | null> {
  const res = await sql`SELECT * FROM invites WHERE code = ${code.toUpperCase()} LIMIT 1`;
  return (res.rows[0] as InviteRow) ?? null;
}

export async function getInviteById(id: number): Promise<InviteRow | null> {
  const res = await sql`SELECT * FROM invites WHERE id = ${id} LIMIT 1`;
  return (res.rows[0] as InviteRow) ?? null;
}

export async function listInvites(): Promise<InviteWithAttempt[]> {
  const res = await sql`
    SELECT i.*, a.id AS attempt_id, a.status AS attempt_status,
           a.mcq_score, a.mcq_total, a.coding_score, a.coding_total,
           a.sql_score, a.sql_total, a.total_score, a.total_possible,
           a.verdict, a.started_at, a.submitted_at, a.deadline_at
    FROM invites i
    LEFT JOIN LATERAL (
      SELECT * FROM attempts WHERE invite_id = i.id ORDER BY started_at DESC LIMIT 1
    ) a ON true
    ORDER BY i.created_at DESC
  `;
  return res.rows as InviteWithAttempt[];
}

export async function updateInviteStatus(id: number, status: string): Promise<void> {
  await sql`UPDATE invites SET status = ${status} WHERE id = ${id}`;
}

// --- Attempts ---

export async function createAttempt(
  inviteId: number,
  deadlineAt: Date,
  questions: unknown
): Promise<AttemptRow> {
  const id = randomUUID();
  const res = await sql`
    INSERT INTO attempts (id, invite_id, deadline_at, answers)
    VALUES (${id}, ${inviteId}, ${deadlineAt.toISOString()}, ${jsonb({ questions })}::jsonb)
    RETURNING *
  `;
  return res.rows[0] as AttemptRow;
}

export async function getAttempt(id: string): Promise<AttemptRow | null> {
  const res = await sql`SELECT * FROM attempts WHERE id = ${id} LIMIT 1`;
  return (res.rows[0] as AttemptRow) ?? null;
}

export async function countSubmittedAttempts(inviteId: number): Promise<number> {
  const res = await sql`
    SELECT COUNT(*)::int AS n FROM attempts
    WHERE invite_id = ${inviteId} AND status IN ('submitted','auto_submitted')
  `;
  return (res.rows[0] as { n: number }).n;
}

export async function saveAttemptAnswers(
  id: string,
  answers: CandidateAnswers
): Promise<void> {
  await sql`
    UPDATE attempts SET answers = jsonb_set(answers, '{answers}', ${jsonb(answers)}::jsonb)
    WHERE id = ${id}
  `;
}

export async function finalizeAttempt(
  id: string,
  data: {
    mcqScore: number;
    mcqTotal: number;
    codingScore: number;
    codingTotal: number;
    sqlTotal: number;
    totalPossible: number;
    answers: CandidateAnswers;
    timeSpentSeconds: number;
  }
): Promise<void> {
  const totalScore = data.mcqScore + data.codingScore;
  await sql`
    UPDATE attempts SET
      status = 'submitted',
      submitted_at = now(),
      mcq_score = ${data.mcqScore},
      mcq_total = ${data.mcqTotal},
      coding_score = ${data.codingScore},
      coding_total = ${data.codingTotal},
      sql_total = ${data.sqlTotal},
      total_score = ${totalScore},
      total_possible = ${data.totalPossible},
      time_spent_seconds = ${data.timeSpentSeconds},
      answers = jsonb_set(answers, '{answers}', ${jsonb(data.answers)}::jsonb)
    WHERE id = ${id}
  `;
}

export async function reviewAttempt(
  id: string,
  data: { sqlScore: number | null; verdict: string | null; notes: string | null }
): Promise<void> {
  await sql`
    UPDATE attempts SET
      sql_score = ${data.sqlScore},
      verdict = ${data.verdict},
      notes = ${data.notes},
      total_score = mcq_score + coding_score + COALESCE(${data.sqlScore}, 0)
    WHERE id = ${id}
  `;
}

export async function listAttempts(inviteId: number): Promise<AttemptRow[]> {
  const res = await sql`
    SELECT * FROM attempts WHERE invite_id = ${inviteId} ORDER BY started_at ASC
  `;
  return res.rows as AttemptRow[];
}
