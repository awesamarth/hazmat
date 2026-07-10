import { NextRequest, NextResponse } from "next/server";
import { createReport, fetchGithubUser, validatePayload } from "@/lib/reports";

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Missing GitHub bearer token." }, { status: 401 });

    const user = await fetchGithubUser(token);
    const payload = validatePayload(await request.json());
    const report = await createReport(user, payload);
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const url = `${origin}/report/${report.owner}`;

    return NextResponse.json({ id: report.id, owner: report.owner, url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
