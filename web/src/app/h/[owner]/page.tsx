import { CopyCommand } from "@/components/CopyCommand";
import { listReports } from "@/lib/reports";
import { HazmatMark } from "@/components/HazmatMark";
import { UsernameSearch } from "@/components/UsernameSearch";

type Props = { params: Promise<{ owner: string }> };

export default async function OwnerPage({ params }: Props) {
  const { owner } = await params;
  const reports = await listReports(owner);

  if (reports.length === 0) return <NoCard owner={owner} />;

  return (
    <main className="hazard-grid min-h-screen bg-ink px-5 py-6 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Nav />
        <section className="border-b border-zinc-800 py-16 text-center">
          <p className="mb-4 font-mono text-sm uppercase tracking-[0.28em] text-hazard">@{owner}</p>
          <h1 className="text-5xl font-black tracking-[-0.07em] sm:text-7xl">Hazmat reports</h1>
          <p className="mt-5 text-zinc-500">{reports.length} published report{reports.length === 1 ? "" : "s"}</p>
        </section>
        <section className="mt-6 grid gap-3">
          {reports.map((report) => (
            <a className="grid gap-3 rounded-2xl border border-zinc-800 bg-panel/90 p-5 transition hover:border-hazard/70 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6" key={report.id} href={`/h/${report.owner}/${report.id}`}>
              <span className="font-mono text-sm text-zinc-500">{date(report.createdAt)}</span>
              <strong className="text-hazard">{report.payload.score}/100</strong>
              <em className="text-sm not-italic text-zinc-500">{report.payload.totals.secretFindings.toLocaleString()} secret-like values</em>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}

function NoCard({ owner }: { owner: string }) {
  return (
    <main className="hazard-grid relative min-h-screen bg-ink px-5 py-6 text-zinc-100 sm:px-8">
      <div className="scanlines pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative mx-auto max-w-5xl">
        <Nav />
        <section className="py-16 text-center sm:py-24">
          <p className="mb-4 font-mono text-sm uppercase tracking-[0.28em] text-hazard">No public card found</p>
          <h1 className="text-5xl font-black tracking-[-0.075em] sm:text-8xl">No card for @{owner}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl leading-8 text-zinc-400">
            This user has not published a Hazmat report yet. Run the CLI locally to generate one.
          </p>
        </section>

        <section className="mx-auto grid max-w-4xl gap-3">
          <CopyCommand label="NPM" command="npx hazmat-cli scan --publish" />
          <CopyCommand label="BUN" command="bunx hazmat-cli scan --publish" />
          <CopyCommand label="MACOS / LINUX" command="curl -sSL https://hazmat-beta.vercel.app/install | sh" />
        </section>

        <section className="mx-auto mt-8 max-w-4xl rounded-2xl border border-zinc-800 bg-panel/90 p-6">
          <p className="mb-3 font-mono text-sm text-hazard">▣ We never see your transcripts</p>
          <p className="leading-7 text-zinc-400">
            Hazmat scans locally and publishes aggregate counts only. Raw transcript text, file paths, project names, prompts, fingerprints, and secret values do not leave your machine.
          </p>
        </section>

        <div className="mx-auto mt-8 max-w-2xl">
          <UsernameSearch />
        </div>
      </div>
    </main>
  );
}

function Nav() {
  return (
    <nav className="flex items-center justify-between text-sm text-zinc-500">
      <a className="flex items-center gap-3" href="/">
        <HazmatMark className="h-10 w-11" />
        <span className="text-2xl font-black leading-none tracking-[-0.06em] text-zinc-100">HAZMAT</span>
      </a>
      <a className="font-mono text-xs uppercase tracking-[0.18em] hover:text-hazard" href="/">Search</a>
    </nav>
  );
}

function date(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
