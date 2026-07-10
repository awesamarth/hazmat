import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { ScanReport } from "./types.js";

export const stateDir = path.join(homedir(), ".hazmat");
export const latestScanPath = path.join(stateDir, "latest-scan.json");

export async function saveLatestScan(report: ScanReport): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  await writeFile(latestScanPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export async function loadLatestScan(): Promise<ScanReport | null> {
  try {
    const raw = await readFile(latestScanPath, "utf8");
    return JSON.parse(raw) as ScanReport;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}
