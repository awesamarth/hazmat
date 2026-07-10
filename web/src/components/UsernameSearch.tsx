"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function UsernameSearch({ compact = false }: { compact?: boolean }) {
  const [username, setUsername] = useState("");
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = username.trim().replace(/^@/, "");
    if (!clean) return;
    router.push(`/report/${encodeURIComponent(clean)}`);
  }

  return (
    <form onSubmit={submit} className={compact ? "flex w-full gap-2" : "mx-auto mt-10 flex w-full max-w-2xl gap-2 rounded-full border border-zinc-700 bg-zinc-950/80 p-2 shadow-[0_0_0_1px_rgba(255,212,0,0.08)]"}>
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        <span className="font-mono text-zinc-500">@</span>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="github-username"
          className="w-full bg-transparent font-mono text-base text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </div>
      <button className="shrink-0 rounded-full bg-hazard px-5 py-3 text-sm font-bold text-black transition hover:bg-[#ffe04a]" type="submit">
        View report
      </button>
    </form>
  );
}
