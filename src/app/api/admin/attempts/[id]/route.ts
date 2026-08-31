import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { reviewAttempt } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: {
    sqlScore?: number | null;
    verdict?: string | null;
    notes?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await reviewAttempt(id, {
    sqlScore:
      typeof body.sqlScore === "number" ? body.sqlScore : null,
    verdict: body.verdict ?? null,
    notes: body.notes ?? null,
  });

  return NextResponse.json({ ok: true });
}
