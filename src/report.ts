import { homedir } from "node:os";
import { calculateScore, scoreLabel } from "./scoring.js";
import { c, formatScore, riskColor } from "./ui.js";
import type { FileRefFinding, ScanReport, SourceReport, SharePayload } from "./types.js";

export function buildScanReport(sources: SourceReport[]): ScanReport {
  const sensitiveSources = sources.filter((source) => source.risk !== "low");
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sources,
    summary: {
      filesScanned: sources.length,
      linesScanned: sum(sources.map((source) => source.linesScanned)),
      sensitiveFiles: sensitiveSources.length,
      highRiskFiles: sources.filter((source) => source.risk === "high").length,
      mediumRiskFiles: sources.filter((source) => source.risk === "medium").length,
      secretFindings: sum(sources.flatMap((source) => source.secrets.map((finding) => finding.count))),
      fileReferenceFindings: sum(
        sources.flatMap((source) => source.fileReferences.map((finding) => finding.count)),
      ),
      score: calculateScore(sources),
    },
  };
}

export function formatReport(report: ScanReport, options: { verbose?: boolean } = {}): string {
  return options.verbose ? formatVerboseReport(report) : formatSummaryReport(report);
}

export function formatScanNextSteps(report: ScanReport, options: { publishHint?: boolean } = {}): string {
  const lines: string[] = [];
  lines.push(c.heading("Next steps"));
  lines.push(c.muted("──────────"));
  if (report.summary.secretFindings > 0) {
    lines.push(`- Preview redactions: ${c.accent("npx hazmat-cli scrub --dry-run")}`);
    lines.push(`- Scrub transcripts in-place: ${c.accent("npx hazmat-cli scrub")}`);
  }
  if (options.publishHint) {
    lines.push(`- Publish your public card (aggregate-only, no raw secrets/private transcript data): ${c.accent("npx hazmat-cli export --publish")}`);
  }
  lines.push(`- Re-open this report later: ${c.accent("npx hazmat-cli report")}`);
  return lines.join("\n");
}

function formatSummaryReport(report: ScanReport): string {
  const lines: string[] = [];
  const secretClasses = aggregateSecretClasses(report);
  const fileRefGroups = aggregateFileReferenceGroups(report);
  const topSources = report.sources
    .filter((source) => source.risk !== "low")
    .map((source) => ({
      source,
      secrets: sum(source.secrets.map((finding) => finding.count)),
      refs: sum(source.fileReferences.map((finding) => finding.count)),
    }))
    .sort((a, b) => b.secrets - a.secrets || b.refs - a.refs)
    .slice(0, 10);

  lines.push(c.heading("Exposure Report"));
  lines.push(c.muted("───────────────"));
  lines.push(`${c.heading("Generated:")} ${c.muted(report.generatedAt)}`);
  lines.push("");
  lines.push(c.heading("Summary"));
  lines.push(c.muted("───────"));
  lines.push(`${c.muted("Scanned")} ${c.value(String(report.summary.filesScanned))} sources, ${c.value(String(report.summary.linesScanned))} records/lines`);
  lines.push(`${c.muted("Score")} ${formatScore(getScore(report))} ${c.muted(`(${scoreLabel(getScore(report))})`)}`);
  lines.push(`${c.muted("Sensitive")} ${c.value(String(report.summary.sensitiveFiles))} files ${c.muted(`(${report.summary.highRiskFiles} high, ${report.summary.mediumRiskFiles} medium)`)}`);
  lines.push(`${c.muted("Secret-like values")} ${c.value(String(report.summary.secretFindings))}`);
  lines.push(`${c.muted("Sensitive file/path refs")} ${c.value(String(report.summary.fileReferenceFindings))}`);

  if (report.summary.sensitiveFiles === 0) {
    lines.push("");
    lines.push("No sensitive transcript findings detected.");
    return lines.join("\n");
  }

  lines.push("");
  lines.push(c.heading("Secret classes"));
  lines.push(c.muted("──────────────"));
  for (const item of secretClasses) {
    lines.push(`- ${c.accent(item.label)}: ${c.value(String(item.count))} occurrences, ${c.value(String(item.unique))} unique fingerprints`);
  }

  lines.push("");
  lines.push(c.heading("Sensitive file/path refs"));
  lines.push(c.muted("────────────────────────"));
  for (const item of fileRefGroups.slice(0, 10)) {
    lines.push(`- ${c.accent(item.label)}: ${c.value(String(item.count))} refs, ${c.value(String(item.unique))} unique paths`);
  }

  lines.push("");
  lines.push(c.heading("Top risky sessions"));
  lines.push(c.muted("──────────────────"));
  for (const item of topSources) {
    lines.push(`- ${riskColor(item.source.risk)(item.source.risk.toUpperCase())} ${c.accent(item.source.harness)} ${c.muted(prettyPath(item.source.path))}`);
    lines.push(`  ${c.value(String(item.secrets))} secret-like findings, ${c.value(String(item.refs))} sensitive refs`);
  }

  lines.push("");
  lines.push(c.muted("Note: raw secret values are not printed. Fingerprints are short SHA-256 hashes."));
  lines.push(c.muted("Run `hazmat report --verbose` for per-session fingerprints and paths."));
  return lines.join("\n");
}

function formatVerboseReport(report: ScanReport): string {
  const lines: string[] = [];
  lines.push("Hazmat Exposure Report");
  lines.push("======================");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Scanned sources: ${report.summary.filesScanned}`);
  lines.push(`Scanned records/lines: ${report.summary.linesScanned}`);
  lines.push(`Score: ${getScore(report)}/100 (${scoreLabel(getScore(report))})`);
  lines.push(`Sensitive files: ${report.summary.sensitiveFiles}`);
  lines.push(`High risk files: ${report.summary.highRiskFiles}`);
  lines.push(`Medium risk files: ${report.summary.mediumRiskFiles}`);
  lines.push(`Secret findings: ${report.summary.secretFindings}`);
  lines.push(`Sensitive file references: ${report.summary.fileReferenceFindings}`);

  const sensitiveSources = report.sources.filter((source) => source.risk !== "low");
  if (sensitiveSources.length === 0) {
    lines.push("");
    lines.push("No sensitive transcript findings detected.");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("Findings");
  lines.push("--------");

  for (const source of sensitiveSources) {
    lines.push("");
    lines.push(`${source.risk.toUpperCase()} ${source.harness} ${prettyPath(source.path)}`);
    lines.push(`Lines scanned: ${source.linesScanned}`);

    if (source.secrets.length > 0) {
      lines.push("Secrets:");
      for (const finding of source.secrets) {
        lines.push(`- ${finding.label}:${finding.fingerprint} (${finding.count})`);
      }
    }

    if (source.fileReferences.length > 0) {
      lines.push("Sensitive file refs:");
      for (const finding of source.fileReferences.slice(0, 20)) {
        lines.push(`- ${finding.value} (${finding.count})`);
      }
      if (source.fileReferences.length > 20) {
        lines.push(`- ...and ${source.fileReferences.length - 20} more`);
      }
    }
  }

  return lines.join("\n");
}

export function buildSharePayload(report: ScanReport): SharePayload {
  return {
    version: 1,
    generatedAt: report.generatedAt,
    score: getScore(report),
    sources: [...new Set(report.sources.map((source) => source.harness))].sort(),
    totals: {
      filesScanned: report.summary.filesScanned,
      sensitiveFiles: report.summary.sensitiveFiles,
      highRiskFiles: report.summary.highRiskFiles,
      mediumRiskFiles: report.summary.mediumRiskFiles,
      secretFindings: report.summary.secretFindings,
      fileReferenceFindings: report.summary.fileReferenceFindings,
    },
    secretClasses: aggregateSecretClasses(report),
    fileReferenceGroups: aggregateFileReferenceGroups(report),
  };
}

function aggregateSecretClasses(report: ScanReport): Array<{ label: string; count: number; unique: number }> {
  const map = new Map<string, { label: string; count: number; fingerprints: Set<string> }>();
  for (const source of report.sources) {
    for (const finding of source.secrets) {
      const current = map.get(finding.label) ?? { label: finding.label, count: 0, fingerprints: new Set<string>() };
      current.count += finding.count;
      current.fingerprints.add(finding.fingerprint);
      map.set(finding.label, current);
    }
  }
  return [...map.values()]
    .map((item) => ({ label: item.label, count: item.count, unique: item.fingerprints.size }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function aggregateFileReferenceGroups(report: ScanReport): Array<{ label: string; count: number; unique: number }> {
  const map = new Map<string, { count: number; values: Set<string> }>();
  for (const source of report.sources) {
    for (const finding of source.fileReferences) {
      const label = fileReferenceGroup(finding);
      const current = map.get(label) ?? { count: 0, values: new Set<string>() };
      current.count += finding.count;
      current.values.add(finding.value);
      map.set(label, current);
    }
  }
  return [...map.entries()]
    .map(([label, item]) => ({ label, count: item.count, unique: item.values.size }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function fileReferenceGroup(finding: FileRefFinding): string {
  const value = finding.value;
  const envMatch = value.match(/\.env(?:\.[A-Za-z0-9_-]+)?/);
  if (envMatch) return envMatch[0];
  if (/wallet/i.test(value)) return "wallet JSON paths";
  if (/keypair/i.test(value)) return "keypair JSON paths";
  if (/\.pem|\.p12|\.pfx|id_rsa|id_ed25519/.test(value)) return "private key/cert paths";
  return "other sensitive paths";
}

function getScore(report: ScanReport): number {
  return typeof report.summary.score === "number" ? report.summary.score : calculateScore(report.sources);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function prettyPath(filePath: string): string {
  const home = homedir();
  return filePath.startsWith(home) ? `~${filePath.slice(home.length)}` : filePath;
}
