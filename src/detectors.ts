import { createHash } from "node:crypto";
import type { FileRefFinding, SecretFinding } from "./types.js";

type SecretMatch = { label: string; value: string };
type FileRefMatch = { label: string; value: string };

const secretPatterns: Array<{ label: string; regex: RegExp; valueGroup?: number; hints: string[] }> = [
  {
    label: "private-key",
    hints: ["PRIVATE KEY"],
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    label: "anthropic-api-key",
    hints: ["sk-ant-"],
    regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    label: "openai-api-key",
    hints: ["sk-"],
    regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    label: "github-token",
    hints: ["ghp_", "gho_", "ghu_", "ghs_", "ghr_"],
    regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    label: "database-url",
    hints: ["postgres://", "postgresql://", "mysql://", "mongodb://", "mongodb+srv://", "redis://"],
    regex: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'`<>\\]+/gi,
  },
  {
    label: "jwt",
    hints: ["eyJ"],
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    label: "webhook-url",
    hints: ["webhook", "hooks.slack", "discord.com/api/webhooks", "discordapp.com/api/webhooks"],
    regex: /https:\/\/[^\s"'`<>]*(?:webhook|hooks\.slack|discord(?:app)?\.com\/api\/webhooks)[^\s"'`<>]*/gi,
  },
  {
    label: "env-secret-assignment",
    hints: [
      "KEY", "TOKEN", "SECRET", "PASSWORD", "DATABASE_URL", "DB_URL", "AUTH",
      "_key", "apikey", "apiKey", "_token", "_secret", "password", "database_url", "db_url", "auth_token",
    ],
    regex: /(?:^|\\n|[^A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|DATABASE_URL|DB_URL|AUTH)[A-Za-z0-9_]*)\s*=\s*(["']?)([^\s"'`\\<>]{8,})\2/gi,
    valueGroup: 3,
  },
];

const fileReferenceHints = [".env", "id_rsa", "id_ed25519", ".pem", ".p12", ".pfx", "wallet", "keypair"];
const fileRefPattern = /(?:^|[\/\s"'`])((?:\.env(?:\.[A-Za-z0-9_-]+)?|id_rsa|id_ed25519|[^\s"'`]+\.(?:pem|p12|pfx)|[^\s"'`]*wallet[^\s"'`]*\.json|[^\s"'`]*keypair[^\s"'`]*\.json))(?=$|[\s"'`,:;])/gi;

export function hasDetectorHint(text: string): boolean {
  return secretPatterns.some((pattern) => pattern.hints.some((hint) => text.includes(hint))) ||
    fileReferenceHints.some((hint) => text.includes(hint));
}

export function detectSecrets(text: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  for (const pattern of secretPatterns) {
    if (!pattern.hints.some((hint) => text.includes(hint))) continue;
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      const value = match[pattern.valueGroup ?? 0];
      if (!value) continue;
      matches.push({ label: pattern.label, value });
    }
  }
  return matches;
}

export function detectFileReferences(text: string): FileRefMatch[] {
  const matches: FileRefMatch[] = [];
  if (!fileReferenceHints.some((hint) => text.includes(hint))) return matches;
  fileRefPattern.lastIndex = 0;
  for (const match of text.matchAll(fileRefPattern)) {
    const value = match[1];
    if (!value) continue;
    matches.push({ label: "sensitive-file-reference", value });
  }
  return matches;
}

export function redactText(text: string): { text: string; redactions: number } {
  let redactions = 0;
  let output = text;

  for (const pattern of secretPatterns) {
    if (!pattern.hints.some((hint) => output.includes(hint))) continue;
    pattern.regex.lastIndex = 0;
    output = output.replace(pattern.regex, (...args: unknown[]) => {
      const match = String(args[0] ?? "");
      const value = pattern.valueGroup === undefined ? match : String(args[pattern.valueGroup] ?? "");
      if (!value) return match;
      redactions += 1;
      const replacement = `<redacted:${pattern.label}:${fingerprint(value)}>`;
      if (pattern.valueGroup === undefined) return replacement;
      return match.replace(value, replacement);
    });
  }

  return { text: output, redactions };
}

export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

export function addSecretFinding(map: Map<string, SecretFinding>, match: SecretMatch) {
  const fp = fingerprint(match.value);
  const key = `${match.label}:${fp}`;
  const existing = map.get(key);
  if (existing) existing.count += 1;
  else map.set(key, { kind: "secret", label: match.label, fingerprint: fp, count: 1 });
}

export function addFileRefFinding(map: Map<string, FileRefFinding>, match: FileRefMatch) {
  const key = `${match.label}:${match.value}`;
  const existing = map.get(key);
  if (existing) existing.count += 1;
  else map.set(key, { kind: "file-reference", label: match.label, value: match.value, count: 1 });
}
