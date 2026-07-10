export type Risk = "low" | "medium" | "high";
export type Harness = "codex" | "claude" | "pi" | "opencode" | "cursor" | "unknown";

export type SecretFinding = {
  kind: "secret";
  label: string;
  fingerprint: string;
  count: number;
};

export type FileRefFinding = {
  kind: "file-reference";
  label: string;
  value: string;
  count: number;
};

export type SourceReport = {
  harness: Harness;
  path: string;
  linesScanned: number;
  risk: Risk;
  secrets: SecretFinding[];
  fileReferences: FileRefFinding[];
  projectPath?: string;
  sessionId?: string;
};

export type ScanReport = {
  version: 1;
  generatedAt: string;
  sources: SourceReport[];
  summary: {
    filesScanned: number;
    linesScanned: number;
    sensitiveFiles: number;
    highRiskFiles: number;
    mediumRiskFiles: number;
    secretFindings: number;
    fileReferenceFindings: number;
    score: number;
  };
};

export type SharePayload = {
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
