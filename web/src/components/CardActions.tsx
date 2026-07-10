"use client";

import { useEffect, useMemo, useState } from "react";
import { tweetText } from "@/lib/cardText";

export function CardActions({ imageUrl, score }: { imageUrl: string; score: number }) {
  const [copied, setCopied] = useState(false);
  const [pageUrl, setPageUrl] = useState("https://hazmat.dev");
  useEffect(() => setPageUrl(window.location.href), []);
  const tweetHref = useMemo(() => {
    const text = tweetText({ score, url: pageUrl });
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }, [pageUrl, score]);

  async function copyPng() {
    const response = await fetch(imageUrl, { cache: "no-store" });
    const blob = await response.blob();
    if (!navigator.clipboard || !("ClipboardItem" in window)) {
      downloadBlob(blob, "hazmat-card.png");
      return;
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function downloadPng() {
    const response = await fetch(imageUrl, { cache: "no-store" });
    downloadBlob(await response.blob(), "hazmat-card.png");
  }

  return (
    <div className="mt-5 flex flex-wrap justify-center gap-3">
      <button onClick={copyPng} className="rounded-full bg-hazard px-5 py-3 text-sm font-black text-black transition hover:bg-[#ffe24d]" type="button">
        {copied ? "Copied PNG" : "Copy PNG"}
      </button>
      <button onClick={downloadPng} className="rounded-full border border-zinc-700 bg-zinc-950/70 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-hazard/70 hover:text-hazard" type="button">
        Download PNG
      </button>
      <a href={tweetHref} target="_blank" rel="noreferrer" className="rounded-full border border-zinc-700 bg-zinc-950/70 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-hazard/70 hover:text-hazard">
        Tweet
      </a>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
