import { notFound } from "next/navigation";
import { getReport } from "@/lib/reports";
import { HazmatMark } from "@/components/HazmatMark";

type Props = { params: Promise<{ owner: string; id: string }> };

export default async function ReportPage({ params }: Props) {
  const { owner, id } = await params;
  const report = await getReport(owner, id);
  if (!report) notFound();
  const payload = report.payload;

  return (
    <main className="hazard-grid min-h-screen bg-ink px-5 py-6 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between text-sm text-zinc-500">
          <a className="flex items-center gap-3" href="/">
            <HazmatMark className="h-10 w-11" />
            <span className="text-2xl font-black leading-none tracking-[-0.06em] text-zinc-100">HAZMAT</span>
          </a>
          <span className="font-mono text-xs uppercase tracking-[0.18em]">published report</span>
        </nav>

        <section className="flex items-start justify-between gap-6 border-b border-zinc-800 py-16 sm:py-20">
          <div>
            <p className="mb-4 font-mono text-sm uppercase tracking-[0.26em] text-hazard">@{report.owner} / {report.id}</p>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.9] tracking-[-0.08em] sm:text-8xl">
              Exposure score <span className="text-hazard">{payload.score}</span>
            </h1>
            <p className="mt-6 text-sm text-zinc-500">Published {date(report.createdAt)} · Scan generated {date(payload.generatedAt)}</p>
          </div>
          {report.ownerAvatarUrl ? <img className="h-14 w-14 rounded-full border border-zinc-800" src={report.ownerAvatarUrl} alt="" /> : null}
        </section>

        <section className="my-6 rounded-2xl border border-zinc-800 bg-panel/90 p-5">
          <div className="flex flex-col justify-between gap-2 text-sm text-zinc-500 sm:flex-row">
            <strong className="text-zinc-100">{scoreLabel(payload.score)}</strong>
            <span>{payload.sources.join(" · ") || "unknown source"}</span>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
            <span className="block h-full bg-hazard" style={{ width: `${payload.score}%` }} />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Stat label="Sources scanned" value={payload.totals.filesScanned} />
          <Stat label="Sensitive sources" value={payload.totals.sensitiveFiles} />
          <Stat label="Secret-like values" value={payload.totals.secretFindings} />
          <Stat label="File/path refs" value={payload.totals.fileReferenceFindings} />
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-2">
          <Group title="Secret classes" items={payload.secretClasses} />
          <Group title="Sensitive refs" items={payload.fileReferenceGroups} />
        </section>

        <section className="mt-5 max-w-3xl rounded-2xl border border-zinc-800 bg-panel/90 p-6">
          <p className="mb-3 font-mono text-sm text-hazard">▣ Privacy boundary</p>
          <p className="leading-7 text-zinc-400">This public report contains aggregate counts only. No transcript paths, prompts, raw secrets, fingerprints, project names, or line contents are stored here.</p>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-zinc-800 bg-panel/90 p-5"><span className="block text-sm text-zinc-500">{label}</span><strong className="mt-2 block text-3xl tracking-[-0.05em] text-zinc-100">{value.toLocaleString()}</strong></div>;
}

function Group({ title, items }: { title: string; items: Array<{ label: string; count: number; unique: number }> }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-panel/90 p-5">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      {items.length === 0 ? <p className="text-sm text-zinc-500">None detected.</p> : (
        <ul>
          {items.slice(0, 12).map((item) => (
            <li className="grid grid-cols-[1fr_auto] gap-x-4 border-t border-zinc-800 py-3" key={item.label}>
              <span className="text-sm text-zinc-200">{item.label}</span>
              <strong className="text-sm text-hazard">{item.count.toLocaleString()}</strong>
              <em className="col-span-2 text-xs not-italic text-zinc-500">{item.unique.toLocaleString()} unique</em>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Clean";
  if (score >= 70) return "Mostly clean";
  if (score >= 40) return "Exposed";
  if (score >= 15) return "High exposure";
  return "Critical exposure";
}

function date(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
