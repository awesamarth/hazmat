import { ImageResponse } from "next/og";
import { exposureHex, exposurePhrase, exposureStatus } from "@/lib/cardText";

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
  const report = mockReport(owner);
  const tone = exposureHex(report.score);
  const logo = new URL("/logo.png", request.url).toString();

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#050505", color: "#f5f5ef", fontFamily: "Arial, sans-serif", padding: 44, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,212,0,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,212,0,.04) 1px, transparent 1px)", backgroundSize: "46px 46px" }} />
      <div style={{ position: "absolute", right: -170, top: -170, width: 430, height: 430, borderRadius: 999, background: `${tone}20` }} />

      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", border: `2px solid ${tone}66`, borderRadius: 42, background: "#080905", overflow: "hidden", padding: 46 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img src={logo} width={78} height={78} style={{ objectFit: "contain" }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", color: tone, fontSize: 24, letterSpacing: 8, fontWeight: 900 }}>HAZMAT</div>
              <div style={{ display: "flex", marginTop: 4, color: "#818178", fontSize: 18, letterSpacing: 4 }}>EXPOSURE REPORT</div>
            </div>
          </div>
          <div style={{ display: "flex", color: "#8a8a82", fontSize: 22 }}>{report.generatedAt}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 72, textAlign: "center" }}>
          <div style={{ display: "flex", color: "#ededdf", fontSize: 58, fontWeight: 900, letterSpacing: -3 }}>@{report.owner}</div>
          <div style={{ display: "flex", marginTop: 26, color: "#85857d", fontSize: 18, letterSpacing: 7 }}>EXPOSURE SCORE</div>
          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 16 }}>
            <div style={{ display: "flex", color: tone, fontSize: 220, lineHeight: .76, letterSpacing: -20, fontWeight: 900 }}>{report.score}</div>
            <div style={{ display: "flex", color: "#85857d", fontSize: 42, fontWeight: 800, marginBottom: 12, marginLeft: 14 }}>/100</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginTop: 32, border: `2px solid ${tone}55`, background: `${tone}16`, borderRadius: 999, padding: "13px 22px" }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: tone }} />
            <div style={{ display: "flex", color: tone, fontSize: 20, letterSpacing: 5, fontWeight: 900 }}>{exposureStatus(report.score)}</div>
          </div>
          <div style={{ display: "flex", marginTop: 28, color: "#f5f5ef", fontSize: 38, fontWeight: 800, letterSpacing: -2 }}>{exposurePhrase(report.score)}</div>
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
          {report.topFindings.map(([label, count]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #28291f", paddingTop: 14, marginTop: 14 }}>
              <div style={{ display: "flex", color: "#e8e8dc", fontSize: 23 }}>{label}</div>
              <div style={{ display: "flex", color: tone, fontSize: 23, fontWeight: 900 }}>{count.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #28291f", paddingTop: 24, color: "#74746b", fontSize: 19 }}>
          <div style={{ display: "flex" }}>aggregate-only · no raw transcripts · no secrets</div>
          <div style={{ display: "flex", color: tone, fontWeight: 900 }}>hazmat.dev</div>
        </div>
      </div>
    </div>,
    size,
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

