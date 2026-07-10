import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import type { SharePayload } from "./types.js";

const DEFAULT_API_URL = "http://localhost:3000";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

export type PublishResult = {
  url: string;
  id: string;
  owner: string;
};

type AuthState = {
  githubAccessToken?: string;
  githubLogin?: string;
};

type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval?: number;
};

type AccessTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export function apiBaseUrl(): string {
  return trimTrailingSlash(process.env.HAZMAT_API_URL || DEFAULT_API_URL);
}

export function githubClientId(): string {
  const value = process.env.HAZMAT_GITHUB_CLIENT_ID || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  if (!value) {
    throw new Error("Missing HAZMAT_GITHUB_CLIENT_ID. Set it to your GitHub OAuth App Client ID.");
  }
  return value;
}

export async function loginWithGithubDeviceFlow(): Promise<AuthState> {
  const clientId = githubClientId();
  const device = await requestDeviceCode(clientId);
  console.log("GitHub login required.");
  console.log(`Open: ${device.verification_uri}`);
  console.log(`Code: ${device.user_code}`);
  console.log("");
  console.log("Waiting for authorization...");

  const token = await pollForAccessToken(clientId, device);
  const user = await fetchGithubUser(token);
  const state = { githubAccessToken: token, githubLogin: user.login };
  await saveAuthState(state);
  console.log(`Logged in as ${user.login}.`);
  return state;
}

export async function publishPayload(payload: SharePayload): Promise<PublishResult> {
  const auth = await loadAuthState();
  const token = auth.githubAccessToken ?? (await loginWithGithubDeviceFlow()).githubAccessToken;
  if (!token) throw new Error("GitHub login failed.");

  const response = await fetch(`${apiBaseUrl()}/api/reports`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null) as Partial<PublishResult> & { error?: string } | null;
  if (!response.ok) throw new Error(body?.error || `Publish failed with HTTP ${response.status}`);
  if (!body?.url || !body.id || !body.owner) throw new Error("Publish response was missing report metadata.");
  return { url: body.url, id: body.id, owner: body.owner };
}

export async function loadAuthState(): Promise<AuthState> {
  try {
    const raw = await readFile(authPath(), "utf8");
    return JSON.parse(raw) as AuthState;
  } catch {
    return {};
  }
}

async function saveAuthState(state: AuthState): Promise<void> {
  await mkdir(path.dirname(authPath()), { recursive: true, mode: 0o700 });
  await writeFile(authPath(), `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function authPath(): string {
  return path.join(homedir(), ".hazmat", "auth.json");
}

async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: clientId, scope: "read:user" }),
  });
  const body = await response.json() as DeviceCodeResponse & { error?: string; error_description?: string };
  if (!response.ok || body.error) throw new Error(body.error_description || body.error || "Failed to start GitHub device login.");
  return body;
}

async function pollForAccessToken(clientId: string, device: DeviceCodeResponse): Promise<string> {
  let intervalMs = Math.max(1, device.interval ?? 5) * 1000;
  const deadline = Date.now() + device.expires_in * 1000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        device_code: device.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const body = await response.json() as AccessTokenResponse;
    if (body.access_token) return body.access_token;
    if (body.error === "authorization_pending") continue;
    if (body.error === "slow_down") {
      intervalMs += 5000;
      continue;
    }
    throw new Error(body.error_description || body.error || `GitHub token exchange failed with HTTP ${response.status}`);
  }

  throw new Error("GitHub device login expired. Run `hazmat login` again.");
}

async function fetchGithubUser(token: string): Promise<{ login: string }> {
  const response = await fetch("https://api.github.com/user", {
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "user-agent": "hazmat-cli" },
  });
  const body = await response.json().catch(() => null) as { login?: string; message?: string } | null;
  if (!response.ok || !body?.login) throw new Error(body?.message || "Failed to fetch GitHub user.");
  return { login: body.login };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}
