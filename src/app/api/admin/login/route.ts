import { NextResponse } from "next/server";
import { createAdminSession, verifyAdminPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!verifyAdminPassword(body.password ?? "")) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  await createAdminSession();
  return NextResponse.json({ ok: true });
}
