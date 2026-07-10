import type { ScanReport, SourceReport } from "./types.js";

export function calculateScore(sources: SourceReport[]): number {
  const secretCount = sources.flatMap((source) => source.secrets).reduce((total, finding) => total + finding.count, 0);
  const refCount = sources.flatMap((source) => source.fileReferences).reduce((total, finding) => total + finding.count, 0);
  const highRiskFiles = sources.filter((source) => source.risk === "high").length;
  const mediumRiskFiles = sources.filter((source) => source.risk === "medium").length;
  const privateKeyCount = sources.flatMap((source) => source.secrets).filter((finding) => finding.label === "private-key").reduce((total, finding) => total + finding.count, 0);

  const secretPenalty = Math.min(70, Math.log10(secretCount + 1) * 25);
  const refPenalty = Math.min(18, Math.log10(refCount + 1) * 5);
  const filePenalty = Math.min(12, highRiskFiles * 1.2 + mediumRiskFiles * 0.4);
  const privateKeyPenalty = Math.min(20, privateKeyCount * 8);

  return Math.max(0, Math.round(100 - secretPenalty - refPenalty - filePenalty - privateKeyPenalty));
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Clean";
  if (score >= 70) return "Mostly clean";
  if (score >= 40) return "Exposed";
  if (score >= 15) return "High exposure";
  return "Critical exposure";
}

export function reportScoreLabel(report: ScanReport): string {
  return scoreLabel(report.summary.score);
}
