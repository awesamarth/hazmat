import { ImageResponse } from "next/og";
import { exposureHex, exposurePhrase, exposureStatus } from "@/lib/cardText";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const report = {
  owner: "awesamarth",
  score: 58,
  generatedAt: "July 10, 2026",
  sources: ["Codex", "Claude", "pi", "OpenCode"],
  stats: {
    sourcesScanned: 412,
    secretLikeValues: 1956,
    sensitiveRefs: 6210,
    highRisk: 81,
  },
  topFindings: [
    ["env-secret-assignment", 1180],
    ["database-url", 388],
    ["jwt", 44],
    ["webhook-url", 32],
  ] as Array<[string, number]>,
};

export default function Image() {
  const tone = exposureHex(report.score);
  const status = exposureStatus(report.score);
  const phrase = exposurePhrase(report.score);

  return new ImageResponse(
    (
      <div style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#050505",
        color: "#f4f4ef",
        fontFamily: "Arial, sans-serif",
        padding: 42,
        position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,212,0,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,212,0,.04) 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
        <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", border: "1px solid rgba(255,212,0,.35)", borderRadius: 30, overflow: "hidden", background: "#080905" }}>
          <div style={{ width: "44%", padding: 42, display: "flex", flexDirection: "column", justifyContent: "space-between", borderRight: "1px solid rgba(255,212,0,.18)" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 42 }}>
                <img src={`${process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000"}/logo.png`} width={82} height={82} style={{ objectFit: "contain" }} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ color: "#ffd400", fontSize: 18, letterSpacing: 4, fontWeight: 700 }}>HAZMAT</div>
                  <div style={{ display: "flex", color: "#d9d9d0", fontSize: 38, fontWeight: 900 }}>@{report.owner}</div>
                </div>
              </div>
              <div style={{ color: "#777", fontSize: 18, letterSpacing: 4, textTransform: "uppercase" }}>Exposure score</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: 12 }}>
                <div style={{ display: "flex", color: tone, fontSize: 170, lineHeight: .78, letterSpacing: -14, fontWeight: 900 }}>{report.score}</div>
                <div style={{ color: "#777", fontSize: 34, fontWeight: 700, marginBottom: 12 }}>/100</div>
              </div>
              <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 12, border: `1px solid ${tone}44`, background: `${tone}18`, borderRadius: 999, padding: "10px 16px", width: "fit-content" }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: tone }} />
                <div style={{ color: tone, fontSize: 18, letterSpacing: 3, fontWeight: 900 }}>{status}</div>
              </div>
              <div style={{ marginTop: 28, display: "flex", color: "#e8e8df", fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{phrase}</div>
            </div>
            <div style={{ display: "flex", color: "#777", fontSize: 18, lineHeight: 1.45 }}>Aggregate-only public card. No transcript paths, prompts, fingerprints, or raw secrets.</div>
          </div>
          <div style={{ flex: 1, padding: 42, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 28, borderBottom: "1px solid #252525", color: "#aaa", fontSize: 22 }}>
              <div style={{ display: "flex" }}>{report.generatedAt}</div>
              <div style={{ display: "flex" }}>{report.sources.join(" · ")}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 30 }}>
              <Stat label="Sources" value={report.stats.sourcesScanned} />
              <Stat label="High-risk" value={report.stats.highRisk} accent />
              <Stat label="Secret-like" value={report.stats.secretLikeValues} accent />
              <Stat label="Refs" value={report.stats.sensitiveRefs} />
            </div>
            <div style={{ marginTop: 30, border: "1px solid #252525", borderRadius: 22, padding: 24, display: "flex", flexDirection: "column", background: "rgba(0,0,0,.28)" }}>
              <div style={{ color: "#aaa", fontSize: 20, letterSpacing: 3, marginBottom: 14 }}>TOP FINDINGS</div>
              {report.topFindings.map(([label, count]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #252525", paddingTop: 14, marginTop: 14, fontSize: 22 }}>
                  <span style={{ color: "#ddd" }}>{label}</span>
                  <span style={{ color: "#ffd400", fontWeight: 800 }}>{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={{ width: 150, border: "1px solid #252525", borderRadius: 18, padding: 20, display: "flex", flexDirection: "column", background: "rgba(0,0,0,.32)" }}>
      <div style={{ color: "#777", fontSize: 15, letterSpacing: 2, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", marginTop: 12, color: accent ? "#ffd400" : "#f4f4ef", fontSize: 38, fontWeight: 900 }}>{value.toLocaleString()}</div>
    </div>
  );
}
