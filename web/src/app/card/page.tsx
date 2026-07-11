import { CardActions } from "@/components/CardActions";
import { HazmatMark } from "@/components/HazmatMark";
import { exposurePhrase, exposureStatus, exposureTone } from "@/lib/cardText";

const report = {
  owner: "awesamarth",
  score: 58,
  status: exposureStatus(58),
  phrase: exposurePhrase(58),
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
  ],
};

export default function CardPreviewPage() {
  const tone = exposureTone(report.score);
  const toneText = tone === "red" ? "text-red-500" : tone === "green" ? "text-emerald-400" : "text-hazard";
  const toneBg = tone === "red" ? "bg-red-500" : tone === "green" ? "bg-emerald-400" : "bg-hazard";
  const toneBorder = tone === "red" ? "border-red-500/25 bg-red-500/10" : tone === "green" ? "border-emerald-400/25 bg-emerald-400/10" : "border-hazard/25 bg-hazard/10";

  return (
    <main className="hazard-grid min-h-screen bg-ink px-5 py-10 text-zinc-100">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between text-sm text-zinc-500">
          <a className="flex items-center gap-3" href="/">
            <HazmatMark className="h-10 w-11" />
            <span className="text-2xl font-black leading-none tracking-[-0.06em] text-zinc-100">HAZMAT</span>
          </a>
          <span className="font-mono text-xs uppercase tracking-[0.18em]">card preview</span>
        </div>

        <CardActions imageUrl="/card/share-image" score={report.score} />

        <article className="mt-6 relative overflow-hidden rounded-[2rem] border border-hazard/30 bg-[#080905] shadow-[0_0_0_1px_rgba(255,212,0,0.08),0_40px_120px_rgba(0,0,0,0.55)]">
          <div className="scanlines pointer-events-none absolute inset-0 opacity-20" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-hazard/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-16 h-64 w-64 rounded-full bg-hazard/10 blur-3xl" />

          <div className="relative grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="flex min-h-[560px] flex-col justify-between border-b border-hazard/15 p-8 sm:p-10 lg:border-b-0 lg:border-r">
              <div>
                <div className="mb-12 flex items-center gap-4">
                  <HazmatMark className="h-20 w-24" />
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.26em] text-hazard">Hazmat report</p>
                    <h1 className="mt-1 text-4xl font-black leading-none tracking-[-0.08em] text-zinc-50">@{report.owner}</h1>
                  </div>
                </div>

                <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">Exposure score</p>
                <div className="mt-3 flex items-end gap-4">
                  <span className={`text-[9rem] font-black leading-[0.78] tracking-[-0.12em] sm:text-[12rem] ${toneText}`}>{report.score}</span>
                  <span className="pb-4 font-mono text-2xl font-bold text-zinc-500">/100</span>
                </div>
                <div className={`mt-7 inline-flex items-center gap-3 rounded-full border px-4 py-2 ${toneBorder}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${toneBg}`} />
                  <span className={`font-mono text-sm uppercase tracking-[0.18em] ${toneText}`}>{report.status}</span>
                </div>
                <p className="mt-8 text-2xl font-semibold tracking-[-0.04em] text-zinc-200">{report.phrase}</p>
              </div>

              <div>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <span className={`block h-full rounded-full ${toneBg}`} style={{ width: `${report.score}%` }} />
                </div>
                <p className="text-sm leading-6 text-zinc-500">
                  Aggregate-only public card. No transcript paths, prompts, line contents, fingerprints, or raw secrets.
                </p>
              </div>
            </div>

            <div className="p-8 sm:p-10">
              <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-zinc-500">Generated</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-200">{report.generatedAt}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-zinc-500">Sources</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-200">{report.sources.join(" · ")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Stat label="Sources scanned" value={report.stats.sourcesScanned} />
                <Stat label="High-risk sources" value={report.stats.highRisk} accent />
                <Stat label="Secret-like values" value={report.stats.secretLikeValues} accent />
                <Stat label="Sensitive refs" value={report.stats.sensitiveRefs} />
              </div>

              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-zinc-400">Top findings</h2>
                  <span className="text-xs text-zinc-600">class / count</span>
                </div>
                <ul className="space-y-3">
                  {report.topFindings.map(([label, count]) => (
                    <li className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-zinc-800 pt-3 first:border-t-0 first:pt-0" key={label}>
                      <span className="truncate font-mono text-sm text-zinc-300">{label}</span>
                      <strong className="font-mono text-sm text-hazard">{Number(count).toLocaleString()}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 rounded-2xl border border-hazard/20 bg-hazard/[0.06] p-5">
                <p className="font-mono text-sm text-hazard">Run locally</p>
                <code className="mt-2 block overflow-x-auto whitespace-nowrap font-mono text-sm text-zinc-300">$ npx hazmat-cli scan --publish</code>
              </div>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <strong className={`mt-3 block text-4xl font-black tracking-[-0.06em] ${accent ? "text-hazard" : "text-zinc-100"}`}>
        {value.toLocaleString()}
      </strong>
    </div>
  );
}
