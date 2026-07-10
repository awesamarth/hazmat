import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type PublicReportPayload = {
  version: 1;
  generatedAt: string;
  score: number;
  sources: string[];
  totals: {
    filesScanned: number;
    sensitiveFiles: number;
    highRiskFiles: number;
    mediumRiskFiles: number;
    secretFindings: number;
    fileReferenceFindings: number;
  };
  secretClasses: Array<{ label: string; count: number; unique: number }>;
  fileReferenceGroups: Array<{ label: string; count: number; unique: number }>;
};

export type StoredReport = {
  id: string;
  owner: string;
  ownerAvatarUrl?: string;
  createdAt: string;
  payload: PublicReportPayload;
};

export type GithubUser = {
  id: number;
  login: string;
  avatar_url?: string;
};

export function validatePayload(input: unknown): PublicReportPayload {
  if (!isObject(input)) throw new Error("Payload must be an object.");
  if (input.version !== 1) throw new Error("Unsupported payload version.");
  const score = numberInRange(input.score, 0, 100, "score");
  const generatedAt = stringValue(input.generatedAt, "generatedAt");
  const sources = arrayOfStrings(input.sources, "sources").slice(0, 20);
  const totalsInput = objectValue(input.totals, "totals");
  const totals = {
    filesScanned: nonNegativeInt(totalsInput.filesScanned, "totals.filesScanned"),
    sensitiveFiles: nonNegativeInt(totalsInput.sensitiveFiles, "totals.sensitiveFiles"),
    highRiskFiles: nonNegativeInt(totalsInput.highRiskFiles, "totals.highRiskFiles"),
    mediumRiskFiles: nonNegativeInt(totalsInput.mediumRiskFiles, "totals.mediumRiskFiles"),
    secretFindings: nonNegativeInt(totalsInput.secretFindings, "totals.secretFindings"),
    fileReferenceFindings: nonNegativeInt(totalsInput.fileReferenceFindings, "totals.fileReferenceFindings"),
  };

  return {
    version: 1,
    generatedAt,
    score,
    sources,
    totals,
    secretClasses: findingGroups(input.secretClasses, "secretClasses"),
    fileReferenceGroups: findingGroups(input.fileReferenceGroups, "fileReferenceGroups"),
  };
}

export async function createReport(user: GithubUser, payload: PublicReportPayload): Promise<StoredReport> {
  const report: StoredReport = {
    id: crypto.randomBytes(5).toString("hex"),
    owner: user.login,
    ownerAvatarUrl: user.avatar_url,
    createdAt: new Date().toISOString(),
    payload,
  };
  const dir = ownerDir(user.login);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${report.id}.json`), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export async function getReport(owner: string, id: string): Promise<StoredReport | null> {
  try {
    const raw = await fs.readFile(path.join(ownerDir(owner), `${id}.json`), "utf8");
    return JSON.parse(raw) as StoredReport;
  } catch {
    return null;
  }
}

export async function listReports(owner: string): Promise<StoredReport[]> {
  try {
    const dir = ownerDir(owner);
    const files = await fs.readdir(dir);
    const reports = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => {
      const raw = await fs.readFile(path.join(dir, file), "utf8");
      return JSON.parse(raw) as StoredReport;
    }));
    return reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function getLatestReport(owner: string): Promise<StoredReport | null> {
  const reports = await listReports(owner);
  return reports[0] ?? null;
}

export async function fetchGithubUser(token: string): Promise<GithubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "hazmat-web",
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as Partial<GithubUser> & { message?: string } | null;
  if (!response.ok || !body?.login || typeof body.id !== "number") {
    throw new Error(body?.message || "Invalid GitHub token.");
  }
  return { id: body.id, login: body.login, avatar_url: body.avatar_url };
}

function ownerDir(owner: string): string {
  return path.join(dataDir(), sanitize(owner));
}

function dataDir(): string {
  return process.env.HAZMAT_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "reports");
}

function sanitize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 80);
}

function findingGroups(input: unknown, name: string): Array<{ label: string; count: number; unique: number }> {
  if (!Array.isArray(input)) throw new Error(`${name} must be an array.`);
  return input.slice(0, 50).map((item, index) => {
    const object = objectValue(item, `${name}[${index}]`);
    return {
      label: stringValue(object.label, `${name}[${index}].label`).slice(0, 80),
      count: nonNegativeInt(object.count, `${name}[${index}].count`),
      unique: nonNegativeInt(object.unique, `${name}[${index}].unique`),
    };
  });
}

function objectValue(value: unknown, name: string): Record<string, unknown> {
  if (!isObject(value)) throw new Error(`${name} must be an object.`);
  return value;
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) throw new Error(`${name} must be a string.`);
  return value;
}

function arrayOfStrings(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array.`);
  return value.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 40));
}

function nonNegativeInt(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer.`);
  return value;
}

function numberInRange(value: unknown, min: number, max: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} is invalid.`);
  return Math.round(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
