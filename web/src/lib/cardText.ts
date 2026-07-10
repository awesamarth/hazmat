export function exposurePhrase(score: number): string {
  if (score === 0) return "it's over for you 💔💔🥀🥀";
  if (score <= 20) return "threat actor speedrun";
  if (score <= 60) return "yolo mode left fingerprints";
  if (score <= 80) return "mildly radioactive";
  if (score < 100) return "clean enough to brag";
  return "sanitized specimen";
}

export function exposureStatus(score: number): string {
  if (score <= 20) return "CRITICAL EXPOSURE";
  if (score === 100) return "ALL CLEAR";
  return "EXPOSURE DETECTED";
}

export function exposureTone(score: number): "red" | "yellow" | "green" {
  if (score <= 20) return "red";
  if (score === 100) return "green";
  return "yellow";
}

export function exposureHex(score: number): string {
  const tone = exposureTone(score);
  if (tone === "red") return "#ff3b30";
  if (tone === "green") return "#28d17c";
  return "#ffd400";
}

export function tweetText(input: { score: number; url: string }): string {
  return [
    "I scanned my AI coding-agent transcripts with Hazmat.",
    "",
    `${input.score}/100 — ${exposurePhrase(input.score)}`,
    "",
    input.url,
  ].join("\n");
}
