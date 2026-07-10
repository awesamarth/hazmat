import chalk from "chalk";
import type { ScanReport } from "./types.js";

export const c = {
  title: chalk.hex("#f2c94c").bold,
  heading: chalk.bold,
  muted: chalk.gray,
  good: chalk.green,
  warn: chalk.yellow,
  danger: chalk.red,
  accent: chalk.cyan,
  value: chalk.white.bold,
};

export function banner(): string {
  const art = [
    "██╗  ██╗ █████╗ ███████╗███╗   ███╗ █████╗ ████████╗",
    "██║  ██║██╔══██╗╚══███╔╝████╗ ████║██╔══██╗╚══██╔══╝",
    "███████║███████║  ███╔╝ ██╔████╔██║███████║   ██║   ",
    "██╔══██║██╔══██║ ███╔╝  ██║╚██╔╝██║██╔══██║   ██║   ",
    "██║  ██║██║  ██║███████╗██║ ╚═╝ ██║██║  ██║   ██║   ",
    "╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ",
  ];
  return art.map((line) => c.title(line)).join("\n");
}

export function formatScore(score: number): string {
  const text = `${score}/100`;
  if (score >= 80) return c.good(text);
  if (score >= 40) return c.warn(text);
  return c.danger(text);
}

export function riskColor(risk: string): (value: string) => string {
  if (risk === "high") return c.danger;
  if (risk === "medium") return c.warn;
  return c.good;
}

export function printBanner(): void {
  console.log(banner());
  console.log(c.muted("Local exposure scanner for AI coding-agent transcripts"));
  console.log("");
}

export function progressLine(status: "start" | "done", index: number, total: number, harness: string, path: string): string {
  const label = status === "start" ? c.warn("start") : c.good("done ");
  return `${c.muted("[")}${label} ${c.muted(`${index}/${total}`)}${c.muted("]")} ${c.accent(harness)} ${c.muted(path)}`;
}

export function savedLine(path: string): string {
  return `${c.good("✓")} Saved latest scan: ${c.muted(path)}`;
}

export function scrubSummary(changedFiles: number, sources: number, redactions: number, changedLines: number, dryRun: boolean, skipped = 0): string {
  const verb = dryRun ? "Would scrub" : "Scrubbed";
  const redacted = dryRun ? "Would redact" : "Redacted";
  const lines = [
    `${c.good("✓")} ${verb} ${c.value(String(changedFiles))}/${sources} sources.`,
    `${redacted} ${c.value(String(redactions))} secret-like values across ${c.value(String(changedLines))} lines/rows.`,
  ];
  if (skipped > 0) lines.push(`${c.warn("!")} Skipped ${c.value(String(skipped))} unreadable/unsupported sources.`);
  lines.push(c.muted("No raw secret values were printed."));
  return lines.join("\n");
}

export function reportHeader(report: ScanReport): string {
  return `${c.heading("Generated:")} ${c.muted(report.generatedAt)}`;
}
