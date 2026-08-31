import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { listInvites, type InviteWithAttempt } from "@/lib/db";
import { AdminDashboard } from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  let invites: InviteWithAttempt[] = [];
  let dbError: string | null = null;
  try {
    invites = await listInvites();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return <AdminDashboard initialInvites={invites} dbError={dbError} />;
}
