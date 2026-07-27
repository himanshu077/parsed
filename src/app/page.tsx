import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  FileText,
  Quote,
  MessagesSquare,
  FolderTree,
  Globe,
  Code2,
  Upload,
  Search,
  Sparkles,
  ShieldCheck,
  Link2,
  ServerCog,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: FileText,
    title: "Any document",
    body: "PDF, Word, text, or Markdown — or import an entire website. If it has words, Parsed can read it.",
  },
  {
    icon: Quote,
    title: "Answers with sources",
    body: "Every answer cites the exact file and passage it came from. Parsed never makes things up.",
  },
  {
    icon: MessagesSquare,
    title: "Chat across files",
    body: "Ask one question across many documents, a whole folder, or your entire library at once.",
  },
  {
    icon: FolderTree,
    title: "Organized your way",
    body: "Nested folders for structure, tags that cut across them. Scope every conversation exactly.",
  },
  {
    icon: Globe,
    title: "Import any website",
    body: "Paste a URL and Parsed crawls the site into one clean, chat-ready document.",
  },
  {
    icon: Code2,
    title: "Embeddable widget",
    body: "Drop a chat widget on any site, scoped to a folder — answer visitors from your own docs.",
  },
];

const STEPS = [
  {
    icon: Upload,
    title: "Upload",
    body: "Drop in files or paste a link. One file or a hundred.",
  },
  {
    icon: Search,
    title: "Parsed indexes it",
    body: "It extracts, chunks, and embeds your content with hybrid search.",
  },
  {
    icon: Sparkles,
    title: "Ask anything",
    body: "Get grounded, cited answers in plain English — in seconds.",
  },
];

const REASONS = [
  {
    icon: ShieldCheck,
    title: "Grounded, not guessing",
    body: "Parsed answers only from your documents — never from the open internet or a model's imagination.",
  },
  {
    icon: Link2,
    title: "Sourced every time",
    body: "Click any citation to jump to the exact passage. Trust, but verify — instantly.",
  },
  {
    icon: ServerCog,
    title: "Yours to host",
    body: "Run it on local models or hosted APIs. Your documents stay in your own stack.",
  },
];

const USE_CASES = [
  "Legal contracts",
  "Financial reports",
  "Research papers",
  "Clinical documents",
  "HR handbooks",
  "Technical specs",
  "Support docs",
  "Due diligence",
];

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isAuthed = !!session;
  const primaryHref = isAuthed ? "/dashboard" : "/auth/sign-up";
  const primaryLabel = isAuthed ? "Go to dashboard" : "Get started free";

  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              P
            </div>
            <span className="text-base font-semibold tracking-tight">Parsed</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#use-cases" className="transition-colors hover:text-foreground">Use cases</a>
          </nav>
          <div className="flex items-center gap-2">
            {!isAuthed && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
            )}
            <Button asChild size="sm" className="gap-1.5">
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, color-mix(in oklab, var(--primary) 22%, transparent) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center md:pt-28">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Grounded answers, with citations
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            Upload any document.{" "}
            <span className="text-primary">Ask anything.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-muted-foreground md:text-lg">
            Parsed reads your PDFs, Word docs, and entire websites — then answers
            your questions in plain English, with citations back to the exact
            source. No more scrolling through pages to find one line.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-1.5">
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">See how it works</a>
            </Button>
          </div>

          {/* Product mock */}
          <div className="mx-auto mt-16 max-w-3xl">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-2xl shadow-primary/5 backdrop-blur">
              <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                  <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                  <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="size-3.5" />
                  annual-report-2025.pdf
                </div>
              </div>
              <div className="space-y-4 p-5 text-left">
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-muted px-4 py-2.5 text-sm">
                    What was revenue growth year over year?
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[85%] space-y-2.5">
                    <div className="rounded-2xl rounded-bl-sm border border-border/60 bg-background/60 px-4 py-3 text-sm">
                      Revenue grew <strong>18% year over year</strong>, from
                      $214M to $253M, driven mainly by the enterprise segment.
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                      <Quote className="size-3.5 text-primary" />
                      annual-report-2025.pdf · page 12
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Everything you need to talk to your documents
          </h2>
          <p className="mt-3 text-muted-foreground">
            From a single contract to an entire data room — Parsed turns static
            files into a conversation.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border/70 bg-card/40 p-6 transition-colors hover:border-primary/40"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border/60 bg-card/20">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              From upload to answer in seconds
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three steps. No setup, no reading required.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-border/70 bg-background/40 p-6">
                <span className="absolute right-5 top-5 text-4xl font-semibold text-muted-foreground/15">
                  {i + 1}
                </span>
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Parsed */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Answers you can actually trust
            </h2>
            <p className="mt-3 text-muted-foreground">
              Most AI tools guess. Parsed is built for the opposite — every
              answer is pulled from your documents and traced back to the source.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-1">
            {REASONS.map((r) => (
              <div
                key={r.title}
                className="flex gap-4 rounded-2xl border border-border/70 bg-card/40 p-5"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <r.icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-medium">{r.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="border-y border-border/60 bg-card/20">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Built for anyone drowning in documents
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Legal, finance, research, healthcare, HR, support — if the answer is
            buried in a file, Parsed finds it.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {USE_CASES.map((u) => (
              <span
                key={u}
                className="rounded-full border border-border/70 bg-background/50 px-4 py-1.5 text-sm text-muted-foreground"
              >
                {u}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/40 px-6 py-16 text-center">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-80"
            style={{
              background:
                "radial-gradient(50% 80% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent) 0%, transparent 70%)",
            }}
          />
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Start chatting with your documents
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Upload your first file and get a sourced answer in under a minute.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="gap-1.5">
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              P
            </div>
            <span className="font-medium text-foreground">Parsed</span>
            <span>— Upload any document. Ask anything.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/auth/sign-in" className="transition-colors hover:text-foreground">Sign in</Link>
            <Link href={primaryHref} className="transition-colors hover:text-foreground">
              {isAuthed ? "Dashboard" : "Get started"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
