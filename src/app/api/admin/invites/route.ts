import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createInvites, listInvites } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const invites = await listInvites();
  return NextResponse.json({ invites });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    candidates?: { name: string; email: string; role?: string }[];
    attemptsAllowed?: number;
    expiresInDays?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const candidates = (body.candidates ?? []).filter(
    (c) => c && c.name && c.email
  );
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one candidate with a name and email." },
      { status: 400 }
    );
  }

  const created = await createInvites(candidates, {
    attemptsAllowed: body.attemptsAllowed ?? 1,
    expiresInDays: body.expiresInDays ?? 7,
  });

  return NextResponse.json({ invites: created });
}
