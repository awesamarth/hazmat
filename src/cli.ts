#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Command } from "commander";
import { discoverCodexFiles, scanCodexFile } from "./codex.js";
import { scanGenericTranscriptFile } from "./jsonl.js";
import { buildScanReport, buildSharePayload, formatReport } from "./report.js";
import { loginWithGithubDeviceFlow, publishPayload } from "./publish.js";
import { scanSQLiteSource } from "./sqlite.js";
import { discoverDefaultSources, discoverPathSources, type ScanSource } from "./sources.js";
import { dryRunSQLiteScrub, scrubSQLiteInPlace } from "./sqliteScrub.js";
import { dryRunScrubTextFile, scrubTextFileInPlace } from "./scrub.js";
import { latestScanPath, loadLatestScan, saveLatestScan } from "./state.js";
import { c, printBanner, progressLine, savedLine, scrubSummary } from "./ui.js";

installWarningFilter();

const program = new Command();

program
  .name("hazmat")
  .description("Local exposure scanner for AI coding-agent transcripts")
  .version("0.0.0");

program
  .command("scan")
  .description("Scan agent transcripts for sensitive exposure")
  .argument("[paths...]", "optional files or directories to scan; defaults to known transcript locations")
  .option("--json", "print JSON instead of terminal report")
  .option("--publish", "publish the privacy-safe export after scanning")
  .action(async (paths: string[], options: { json?: boolean; publish?: boolean }) => {
    const report = await runScan(paths, { quiet: Boolean(options.json) });

    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(formatReport(report));
      console.log("");
      console.log(savedLine(latestScanPath));
    }

    if (options.publish) await publishReport(report);
  });

program
  .command("scrub")
  .description("Redact secret values in transcript files/databases in-place")
  .argument("[paths...]", "optional files, directories, or DBs to scrub; defaults to known transcript locations")
  .option("--dry-run", "show what would change without modifying files")
  .option("--yes", "skip confirmation prompt")
  .action(async (paths: string[], options: { dryRun?: boolean; yes?: boolean }) => {
    const scrubSources = paths.length > 0 ? await discoverPathSources(paths) : await discoverDefaultSources();

    if (!options.dryRun && !options.yes) {
      const ok = await confirmScrub(scrubSources.length, paths.length === 0);
      if (!ok) {
        console.error("Scrub cancelled.");
        process.exitCode = 1;
        return;
      }
    }
    const concurrency = Math.max(1, Math.min(4, cpus().length || 1));
    console.error(`${options.dryRun ? "Checking" : "Scrubbing"} ${scrubSources.length} sources with concurrency ${concurrency}...`);

    const results = await mapLimit(scrubSources, concurrency, async (source, index) => {
      console.error(progressLine("start", index + 1, scrubSources.length, source.harness, source.path));
      try {
        const result = await scrubSource(source, Boolean(options.dryRun));
        console.error(progressLine("done", index + 1, scrubSources.length, source.harness, source.path));
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${c.warn("skip")} ${source.harness} ${source.path}: ${message}`);
        return null;
      }
    });

    const completed = results.filter((result) => result !== null);
    const skipped = scrubSources.length - completed.length;
    const changedFiles = completed.filter((result) => result.changed > 0).length;
    const redactions = completed.reduce((total, result) => total + result.redactions, 0);
    const changedLines = completed.reduce((total, result) => total + result.changed, 0);
    console.log(scrubSummary(changedFiles, scrubSources.length, redactions, changedLines, Boolean(options.dryRun), skipped));
  });

program
  .command("export")
  .description("Export or publish the privacy-safe aggregate report from the latest scan")
  .option("--json", "print privacy-safe JSON to stdout")
  .option("--out <path>", "write privacy-safe JSON to a file")
  .option("--publish", "publish the privacy-safe export to the configured backend")
  .action(async (options: { json?: boolean; out?: string; publish?: boolean }) => {
    const report = await loadLatestScan();
    if (!report) {
      console.error("No scan report found. Run: hazmat scan");
      process.exitCode = 1;
      return;
    }
    const payload = buildSharePayload(report);
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    if (options.out) {
      await writeFile(options.out, json, "utf8");
      console.log(`Wrote privacy-safe export: ${options.out}`);
    }
    if (options.publish) await publishReport(report);
    if (options.json || (!options.out && !options.publish)) console.log(json);
  });

program
  .command("share", { hidden: true })
  .description("Alias for export")
  .option("--out <path>", "write privacy-safe JSON to a file")
  .option("--publish", "publish the privacy-safe export to the configured backend")
  .action(async (options: { out?: string; publish?: boolean }) => {
    const report = await loadLatestScan();
    if (!report) {
      console.error("No scan report found. Run: hazmat scan");
      process.exitCode = 1;
      return;
    }
    const payload = buildSharePayload(report);
    if (options.out) {
      await writeFile(options.out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      console.log(`Wrote privacy-safe export: ${options.out}`);
    }
    if (options.publish) await publishReport(report);
    if (!options.out && !options.publish) console.log(`${JSON.stringify(payload, null, 2)}\n`);
  });

program
  .command("login")
  .description("Log in with GitHub for publishing reports")
  .action(async () => {
    await loginWithGithubDeviceFlow();
  });

program
  .command("report")
  .description("Show latest saved scan report")
  .option("--json", "print JSON instead of terminal report")
  .option("--verbose", "show per-session fingerprints and paths")
  .action(async (options: { json?: boolean; verbose?: boolean }) => {
    const report = await loadLatestScan();
    if (!report) {
      console.error("No scan report found. Run: hazmat scan");
      process.exitCode = 1;
      return;
    }

    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      printBanner();
      console.log(formatReport(report, { verbose: options.verbose }));
    }
  });

function installWarningFilter(): void {
  const originalEmitWarning = process.emitWarning.bind(process);
  process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
    const message = typeof warning === "string" ? warning : warning.message;
    if (message.includes("SQLite is an experimental feature")) return;
    return originalEmitWarning(warning as never, ...(args as never[]));
  }) as typeof process.emitWarning;
}

async function runScan(paths: string[], options: { quiet: boolean }) {
  const scanSources = paths.length > 0 ? await discoverPathSources(paths) : await discoverDefaultSources();
  const concurrency = Math.max(1, Math.min(4, cpus().length || 1));

  if (!options.quiet) {
    printBanner();
    console.log(`${c.heading("Scanning")} ${c.value(String(scanSources.length))} sources ${c.muted(`with concurrency ${concurrency}`)}...`);
  }

  const sourceResults = await mapLimit(scanSources, concurrency, async (source, index) => {
    if (!options.quiet) console.log(progressLine("start", index + 1, scanSources.length, source.harness, source.path));
    const result = await scanSource(source);
    if (!options.quiet) console.log(progressLine("done", index + 1, scanSources.length, source.harness, source.path));
    return result;
  });

  const report = buildScanReport(sourceResults.filter((source): source is NonNullable<typeof source> => source !== null));
  await saveLatestScan(report);
  return report;
}

async function publishReport(report: Awaited<ReturnType<typeof buildScanReport>>): Promise<void> {
  const payload = buildSharePayload(report);
  const result = await publishPayload(payload);
  console.log(`${c.good("✓")} Published report: ${c.accent(result.url)}`);
}

async function scanSource(source: ScanSource) {
  if (source.kind === "sqlite") return scanSQLiteSource(source.path, source.harness);
  if (source.harness === "codex") return scanCodexFile(source.path);
  return scanGenericTranscriptFile(source.path, source.harness);
}

type ScrubSummaryResult = { changed: number; redactions: number };

async function scrubSource(source: ScanSource, dryRun: boolean): Promise<ScrubSummaryResult | null> {
  if (source.kind === "sqlite") {
    const result = dryRun
      ? await dryRunSQLiteScrub(source.path, source.harness)
      : await scrubSQLiteInPlace(source.path, source.harness);
    if (!result) return null;
    return { changed: result.rowsChanged, redactions: result.redactions };
  }

  const result = dryRun ? await dryRunScrubTextFile(source.path) : await scrubTextFileInPlace(source.path);
  return { changed: result.linesChanged, redactions: result.redactions };
}

async function confirmScrub(fileCount: number, isDefaultDiscovery: boolean): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error("Non-interactive shell detected. Re-run with --yes to scrub.");
    return false;
  }

  const scope = isDefaultDiscovery ? "all discovered transcript sources" : "the selected transcript sources";
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(
      `This will redact secret-like values in-place in ${fileCount} files (${scope}). Continue? [Y/n] `,
    );
    const normalized = answer.trim().toLowerCase();
    return normalized === "" || normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index] as T, index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`hazmat: ${message}`);
  process.exit(1);
});
