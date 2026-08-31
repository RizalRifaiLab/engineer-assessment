import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * One-time (idempotent) database setup. Protected by an admin session or a
 * SETUP_TOKEN query param.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const authorized =
    (await isAdmin()) ||
    (!!process.env.SETUP_TOKEN && token === process.env.SETUP_TOKEN);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureSchema();
    return NextResponse.json({ ok: true, message: "Database schema is ready." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
