import { sql } from "@vercel/postgres";

/** Creates tables if they do not exist yet. Idempotent — safe to call repeatedly. */
export async function ensureSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS invites (
      id BIGSERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      candidate_name TEXT NOT NULL,
      candidate_email TEXT NOT NULL,
      role TEXT,
      status TEXT NOT NULL DEFAULT 'unused',
      attempts_allowed INT NOT NULL DEFAULT 1,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      invite_id BIGINT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      submitted_at TIMESTAMPTZ,
      deadline_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      mcq_score INT NOT NULL DEFAULT 0,
      mcq_total INT NOT NULL DEFAULT 0,
      coding_score INT NOT NULL DEFAULT 0,
      coding_total INT NOT NULL DEFAULT 0,
      sql_score INT,
      sql_total INT NOT NULL DEFAULT 0,
      total_score INT,
      total_possible INT NOT NULL DEFAULT 0,
      time_spent_seconds INT NOT NULL DEFAULT 0,
      verdict TEXT,
      notes TEXT,
      answers JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_attempts_invite ON attempts (invite_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts (status)`;
}
