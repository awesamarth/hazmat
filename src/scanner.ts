import {
  addFileRefFinding,
  addSecretFinding,
  detectFileReferences,
  detectSecrets,
  hasDetectorHint,
} from "./detectors.js";
import type { FileRefFinding, Harness, SourceReport, SecretFinding } from "./types.js";

export type FindingState = {
  secrets: Map<string, SecretFinding>;
  fileReferences: Map<string, FileRefFinding>;
};

export function createFindingState(): FindingState {
  return { secrets: new Map(), fileReferences: new Map() };
}

export function scanCandidateText(text: string, state: FindingState): void {
  if (!hasDetectorHint(text)) return;
  for (const chunk of scanChunks(text)) {
    for (const match of detectSecrets(chunk)) addSecretFinding(state.secrets, match);
    for (const match of detectFileReferences(chunk)) addFileRefFinding(state.fileReferences, match);
  }
}

export function buildSourceReport(input: {
  harness: Harness;
  path: string;
  linesScanned: number;
  state: FindingState;
  projectPath?: string;
  sessionId?: string;
}): SourceReport {
  const secretList = [...input.state.secrets.values()].sort(byLabelThenFingerprint);
  const fileRefList = [...input.state.fileReferences.values()].sort((a, b) => a.value.localeCompare(b.value));
  const risk: SourceReport["risk"] = secretList.length > 0 ? "high" : fileRefList.length > 0 ? "medium" : "low";
  return {
    harness: input.harness,
    path: input.path,
    linesScanned: input.linesScanned,
    risk,
    secrets: secretList,
    fileReferences: fileRefList,
    ...(input.projectPath ? { projectPath: input.projectPath } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
  };
}

function* scanChunks(text: string): Generator<string> {
  const chunkSize = 256 * 1024;
  const overlap = 2048;
  if (text.length <= chunkSize) {
    yield text;
    return;
  }
  for (let start = 0; start < text.length; start += chunkSize - overlap) yield text.slice(start, start + chunkSize);
}

function byLabelThenFingerprint(a: SecretFinding, b: SecretFinding): number {
  return a.label.localeCompare(b.label) || a.fingerprint.localeCompare(b.fingerprint);
}
