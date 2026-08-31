import Link from "next/link";
import { getInviteByCode } from "@/lib/db";
import { StartTest } from "@/components/StartTest";

export const dynamic = "force-dynamic";

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-md text-slate-500">{body}</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Back to home
      </Link>
    </main>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = code.trim().toUpperCase();

  let invite = null;
  let dbError: string | null = null;
  try {
    invite = await getInviteByCode(normalized);
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  if (dbError) {
    return (
      <Message
        title="Something went wrong"
        body="The database could not be reached. If you are the admin, make sure the database is set up."
      />
    );
  }

  if (!invite) {
    return (
      <Message
        title="Invalid invite code"
        body={`No invite was found for code "${normalized}". Please check the code and try again.`}
      />
    );
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return (
      <Message
        title="Invite expired"
        body="This invite link has expired. Please contact your recruiter for a new one."
      />
    );
  }

  if (invite.status === "completed") {
    return (
      <Message
        title="Assessment already completed"
        body="This invite has already been used for all its allowed attempts."
      />
    );
  }

  return (
    <StartTest
      code={invite.code}
      invite={{
        name: invite.candidate_name,
        email: invite.candidate_email,
        role: invite.role,
      }}
    />
  );
}
