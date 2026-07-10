import { neon } from "@neondatabase/serverless";

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

type ReportRow = {
  id: string;
  github_login: string;
  avatar_url: string | null;
  payload_json: PublicReportPayload | string;
  updated_at: string | Date;
};

let initialized = false;

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
  const sql = await db();
  const id = randomId();
  const rows = await sql`
    insert into reports (github_login, github_id, avatar_url, report_id, payload_json, score, updated_at)
    values (${user.login}, ${user.id}, ${user.avatar_url ?? null}, ${id}, ${JSON.stringify(payload)}::jsonb, ${payload.score}, now())
    on conflict (github_login) do update set
      github_id = excluded.github_id,
      avatar_url = excluded.avatar_url,
      report_id = excluded.report_id,
      payload_json = excluded.payload_json,
      score = excluded.score,
      updated_at = now()
    returning report_id as id, github_login, avatar_url, payload_json, updated_at
  ` as ReportRow[];

  return rowToReport(rows[0]);
}

export async function getReport(owner: string, _id: string): Promise<StoredReport | null> {
  return getLatestReport(owner);
}

export async function listReports(owner: string): Promise<StoredReport[]> {
  const latest = await getLatestReport(owner);
  return latest ? [latest] : [];
}

export async function getLatestReport(owner: string): Promise<StoredReport | null> {
  if (!process.env.DATABASE_URL) return null;
  const sql = await db();
  const rows = await sql`
    select report_id as id, github_login, avatar_url, payload_json, updated_at
    from reports
    where lower(github_login) = lower(${owner})
    limit 1
  ` as ReportRow[];
  return rows[0] ? rowToReport(rows[0]) : null;
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

async function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  const sql = neon(url);
  if (!initialized) {
    await sql`
      create table if not exists reports (
        github_login text primary key,
        github_id bigint not null,
        avatar_url text,
        report_id text not null,
        payload_json jsonb not null,
        score integer not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    initialized = true;
  }
  return sql;
}

function rowToReport(row: ReportRow | undefined): StoredReport {
  if (!row) throw new Error("Report row missing.");
  const payload = typeof row.payload_json === "string" ? JSON.parse(row.payload_json) as PublicReportPayload : row.payload_json;
  return {
    id: row.id,
    owner: row.github_login,
    ...(row.avatar_url ? { ownerAvatarUrl: row.avatar_url } : {}),
    createdAt: new Date(row.updated_at).toISOString(),
    payload,
  };
}

function randomId(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
