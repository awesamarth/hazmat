import { CopyCommand } from "@/components/CopyCommand";
import { HazmatMark } from "@/components/HazmatMark";
import { UsernameSearch } from "@/components/UsernameSearch";

export default function Home() {
  return (
    <main className="hazard-grid relative min-h-screen overflow-hidden bg-ink text-zinc-100">
      <div className="scanlines pointer-events-none absolute inset-0 opacity-25" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-hazard/70" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8">
        <nav className="flex items-center justify-between text-sm text-zinc-500">
          <a className="flex items-center gap-3" href="/">
            <HazmatMark className="h-11 w-12" />
            <span className="text-3xl font-black leading-none tracking-[-0.06em] text-zinc-100">HAZMAT</span>
          </a>
          <div className="hidden items-center gap-6 font-mono text-xs uppercase tracking-[0.18em] sm:flex">
            <a className="hover:text-hazard" href="#install">Install</a>
            <a className="hover:text-hazard" href="#privacy">Privacy</a>
          </div>
        </nav>

        <section className="flex flex-1 flex-col items-center justify-center py-20 text-center sm:py-28">
          <p className="mb-5 font-mono text-sm uppercase tracking-[0.34em] text-hazard">AI transcript decontamination</p>
          <h1 className="max-w-6xl text-[clamp(4.4rem,13vw,12rem)] font-black leading-[0.78] tracking-[-0.1em] text-zinc-50">
            HAZMAT
          </h1>
          <p className="mt-8 max-w-3xl text-balance text-2xl font-semibold leading-tight tracking-[-0.04em] text-zinc-200 sm:text-4xl">
            Scan and scrub agent transcripts before they leak.
          </p>
          <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
            Local cleanup. Public aggregate cards. No raw transcripts.
          </p>

          <UsernameSearch />

          <div className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">
            No transcript uploads · No raw secrets · No prompt text
          </div>
        </section>

        <section id="install" className="grid gap-3 border-t border-zinc-800 py-8 md:grid-cols-3">
          <CopyCommand label="NPM" command="npx hazmat scan --publish" />
          <CopyCommand label="BUN" command="bunx hazmat scan --publish" />
          <CopyCommand label="CURL" command="curl -sSL https://hazmat.dev/install | sh" />
        </section>

        <section id="privacy" className="border-t border-zinc-800 py-8">
          <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-800 bg-panel/80 p-6">
            <p className="mb-3 font-mono text-sm text-hazard">▣ Privacy boundary</p>
            <p className="leading-7 text-zinc-400">
              Published cards contain only aggregate counts: score, source types, secret classes, and grouped sensitive-file references. Raw transcripts, file paths, project names, prompts, line contents, fingerprints, and secrets stay local.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

