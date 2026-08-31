"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    router.push(`/t/${encodeURIComponent(c.toUpperCase())}`);
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter invite code"
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-code text-lg uppercase tracking-widest outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        autoFocus
      />
      <button
        type="submit"
        disabled={!code.trim()}
        className="shrink-0 rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start
      </button>
    </form>
  );
}
