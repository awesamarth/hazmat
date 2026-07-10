"use client";

import { useState } from "react";

export function CopyCommand({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/85 p-3 font-mono text-sm">
      <span className="shrink-0 rounded-md bg-hazard px-2.5 py-1 text-xs font-black text-black">{label}</span>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-zinc-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="text-zinc-500">$</span> {command}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition hover:border-hazard/70 hover:text-hazard"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
