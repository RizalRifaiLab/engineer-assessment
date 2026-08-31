import Link from "next/link";
import { CodeEntry } from "@/components/CodeEntry";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
            EA
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Software Engineer Assessment
          </h1>
          <p className="mt-2 text-slate-500">
            Enter the invite code you received to begin your timed assessment.
          </p>
        </div>

        <CodeEntry />

        <div className="mt-6 text-center text-sm">
          <Link href="/admin/login" className="text-indigo-600 hover:underline">
            Recruiter? Sign in →
          </Link>
        </div>
      </div>
    </main>
  );
}
