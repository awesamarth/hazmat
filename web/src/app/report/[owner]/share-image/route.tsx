import { ImageResponse } from "next/og";
import { exposureHex, exposurePhrase, exposureStatus } from "@/lib/cardText";
import { getLatestReport } from "@/lib/reports";

export const runtime = "edge";

const size = { width: 1080, height: 1350 };
type Props = { params: Promise<{ owner: string }> };

type CardReport = {
  owner: string;
  score: number;
  generatedAt: string;
  sources: string[];
  stats: { sourcesScanned: number; secretLikeValues: number; sensitiveRefs: number; highRisk: number };
  topFindings: Array<[string, number]>;
};

export async function GET(request: Request, { params }: Props) {
  const { owner } = await params;
  const report = await loadCardReport(owner);
  const tone = exposureHex(report.score);
  const logo = new URL("/logo.png", request.url).toString();
  const status = exposureStatus(report.score);
  const phrase = exposurePhrase(report.score);

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#050505", color: "#f5f5ef", fontFamily: "Arial, sans-serif", padding: 44, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,212,0,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,212,0,.035) 1px, transparent 1px)", backgroundSize: "46px 46px" }} />

      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", border: `2px solid ${tone}66`, borderRadius: 42, background: "#080905", overflow: "hidden", padding: 46 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", width: 104, height: 94, alignItems: "center", justifyContent: "center", overflow: "visible" }}>
              <img src={logo} width={96} height={85} style={{ objectFit: "contain" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", color: tone, fontSize: 24, letterSpacing: 8, fontWeight: 900 }}>HAZMAT</div>
              <div style={{ display: "flex", marginTop: 4, color: "#818178", fontSize: 18, letterSpacing: 4 }}>EXPOSURE REPORT</div>
            </div>
          </div>
          <div style={{ display: "flex", color: "#8a8a82", fontSize: 22 }}>{report.generatedAt}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 68, textAlign: "center" }}>
          <div style={{ display: "flex", color: "#ededdf", fontSize: 58, fontWeight: 900, letterSpacing: -3 }}>@{report.owner}</div>
          <div style={{ display: "flex", marginTop: 26, color: "#85857d", fontSize: 18, letterSpacing: 7 }}>EXPOSURE SCORE</div>
          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 16 }}>
            <div style={{ display: "flex", color: tone, fontSize: 220, lineHeight: .76, letterSpacing: -20, fontWeight: 900 }}>{report.score}</div>
            <div style={{ display: "flex", color: "#85857d", fontSize: 42, fontWeight: 800, marginBottom: 12, marginLeft: 14 }}>/100</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 13, marginTop: 32, border: `2px solid ${tone}55`, background: `${tone}16`, borderRadius: 999, padding: "13px 24px", minWidth: 360 }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: tone }} />
            <div style={{ display: "flex", color: tone, fontSize: 19, letterSpacing: 4, fontWeight: 900, whiteSpace: "nowrap" }}>{status}</div>
          </div>
          <div style={{ display: "flex", marginTop: 28, color: "#f5f5ef", fontSize: 34, fontWeight: 800, letterSpacing: -2, whiteSpace: "nowrap" }}>{phrase}</div>
        </div>

        <div style={{ display: "flex", height: 12, marginTop: 44, borderRadius: 999, background: "#25261f", overflow: "hidden" }}>
          <div style={{ display: "flex", width: `${report.score}%`, background: tone }} />
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 42 }}>
          <Stat label="SOURCES" value={report.stats.sourcesScanned} />
          <Stat label="HIGH-RISK" value={report.stats.highRisk} color={tone} />
          <Stat label="SECRETS" value={report.stats.secretLikeValues} color={tone} />
          <Stat label="REFS" value={report.stats.sensitiveRefs} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 34, border: "1px solid #28291f", borderRadius: 28, padding: 26, background: "rgba(0,0,0,.35)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", color: "#b2b2a8", fontSize: 18, letterSpacing: 6, fontWeight: 800 }}>TOP FINDINGS</div>
            <div style={{ display: "flex", color: "#696961", fontSize: 18 }}>class / count</div>
          </div>
          {report.topFindings.length === 0 ? (
            <div style={{ display: "flex", borderTop: "1px solid #28291f", paddingTop: 18, marginTop: 14, color: "#e8e8dc", fontSize: 23 }}>no raw secret-like values detected</div>
          ) : report.topFindings.map(([label, count]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #28291f", paddingTop: 14, marginTop: 14 }}>
              <div style={{ display: "flex", color: "#e8e8dc", fontSize: 23 }}>{label}</div>
              <div style={{ display: "flex", color: tone, fontSize: 23, fontWeight: 900 }}>{count.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 18, color: "#74746b", fontSize: 19 }}>
          <div style={{ display: "flex" }}>aggregate-only · no raw transcripts · no secrets</div>
          <div style={{ display: "flex", color: tone, fontWeight: 900 }}>hazmat-beta.vercel.app</div>
        </div>
      </div>
    </div>,
    {
      ...size,
      headers: { "cache-control": "no-store, max-age=0" },
    },
  );
}

function Stat({ label, value, color = "#f5f5ef" }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid #28291f", borderRadius: 22, padding: 20, background: "rgba(0,0,0,.35)" }}>
      <div style={{ display: "flex", color: "#7a7a72", fontSize: 14, letterSpacing: 3, fontWeight: 800 }}>{label}</div>
      <div style={{ display: "flex", marginTop: 13, color, fontSize: 36, fontWeight: 900 }}>{value.toLocaleString()}</div>
    </div>
  );
}

async function loadCardReport(owner: string): Promise<CardReport> {
  const stored = await getLatestReport(owner);
  if (!stored) return mockReport(owner);
  const payload = stored.payload;
  return {
    owner: stored.owner,
    score: payload.score,
    generatedAt: formatDate(payload.generatedAt),
    sources: payload.sources.map(capitalize),
    stats: {
      sourcesScanned: payload.totals.filesScanned,
      secretLikeValues: payload.totals.secretFindings,
      sensitiveRefs: payload.totals.fileReferenceFindings,
      highRisk: payload.totals.highRiskFiles,
    },
    topFindings: payload.secretClasses.slice(0, 4).map((item) => [item.label, item.count]),
  };
}

function mockReport(owner: string): CardReport {
  return {
    owner,
    score: 58,
    generatedAt: "July 10, 2026",
    sources: ["Codex", "Claude", "pi", "OpenCode"],
    stats: { sourcesScanned: 412, secretLikeValues: 1956, sensitiveRefs: 6210, highRisk: 81 },
    topFindings: [["env-secret-assignment", 1180], ["database-url", 388], ["jwt", 44], ["webhook-url", 32]],
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function capitalize(value: string): string {
  if (value === "pi") return "pi";
  if (value.toLowerCase() === "opencode") return "OpenCode";
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
