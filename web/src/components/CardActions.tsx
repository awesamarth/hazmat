"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tweetText } from "@/lib/cardText";

export function CardActions({ imageUrl, score }: { imageUrl: string; score: number }) {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">("idle");
  const [downloadState, setDownloadState] = useState<"idle" | "downloading">("idle");
  const [pageUrl, setPageUrl] = useState("https://hazmat-beta.vercel.app");
  const imageBlobRef = useRef<Blob | null>(null);
  const imagePromiseRef = useRef<Promise<Blob> | null>(null);

  useEffect(() => {
    setPageUrl(window.location.href);
    const timer = window.setTimeout(() => void warmImage(), 350);
    return () => window.clearTimeout(timer);
  }, []);
  const tweetHref = useMemo(() => {
    const text = tweetText({ score, url: pageUrl });
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }, [pageUrl, score]);

  async function getImageBlob() {
    if (imageBlobRef.current) return imageBlobRef.current;
    imagePromiseRef.current ??= fetch(imageUrl, { cache: "reload" }).then((response) => response.blob());
    imageBlobRef.current = await imagePromiseRef.current;
    return imageBlobRef.current;
  }

  async function warmImage() {
    try {
      await getImageBlob();
    } catch {
      imagePromiseRef.current = null;
    }
  }

  async function copyPng() {
    setCopyState("copying");
    try {
      const blob = await getImageBlob();
      if (!navigator.clipboard || !("ClipboardItem" in window)) {
        downloadBlob(blob, "hazmat-card.png");
        setCopyState("idle");
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      imagePromiseRef.current = null;
      setCopyState("idle");
    }
  }

  async function downloadPng() {
    setDownloadState("downloading");
    try {
      downloadBlob(await getImageBlob(), "hazmat-card.png");
    } finally {
      setDownloadState("idle");
    }
  }

  return (
    <div className="mt-5 flex flex-wrap justify-center gap-3">
      <button onClick={copyPng} className="w-36 cursor-pointer rounded-full bg-hazard px-5 py-3 text-sm font-black text-black transition hover:bg-[#ffe24d]" type="button" disabled={copyState === "copying"}>
        {copyState === "copying" ? "Copying…" : copyState === "copied" ? "Copied" : "Copy PNG"}
      </button>
      <button onClick={downloadPng} className="w-40 cursor-pointer rounded-full border border-zinc-700 bg-zinc-950/70 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-hazard/70 hover:text-hazard" type="button" disabled={downloadState === "downloading"}>
        {downloadState === "downloading" ? "Downloading…" : "Download PNG"}
      </button>
      <a href={tweetHref} target="_blank" rel="noreferrer" className="w-28 cursor-pointer rounded-full border border-zinc-700 bg-zinc-950/70 px-5 py-3 text-center text-sm font-bold text-zinc-200 transition hover:border-hazard/70 hover:text-hazard">
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
