import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Code2,
  FolderOpen,
  Globe,
  KeyRound,
  LifeBuoy,
  MessageSquare,
  Tag,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/**
 * Support documentation — how to actually use Parsed.
 *
 * Static content, no client JS. It describes what the app does TODAY, so
 * anything here that stops being true is a bug in this page.
 */

const FILE_STATUS = [
  {
    label: "Uploading",
    detail: "The file is still being sent to storage. Wait a moment.",
  },
  {
    label: "Processing",
    detail:
      "Parsed is reading the text, splitting it into pieces and indexing it for search. Usually under a minute for a normal document.",
  },
  {
    label: "Ready",
    detail: "You can chat with it. Only files in this state are used to answer questions.",
  },
  {
    label: "Error",
    detail:
      "Something went wrong while reading the file. Open the file menu and choose Retry processing. If it keeps failing, check the file opens on your computer and is under 50 MB.",
  },
];

const SCENARIOS = [
  {
    icon: BookOpen,
    title: "Study a long report or contract",
    detail:
      "Upload the PDF, open it, and ask things like “What are the payment terms?” or “Summarise section 3”. Every answer shows which part of the file it came from.",
    href: "/dashboard",
    linkLabel: "Upload a file",
  },
  {
    icon: FolderOpen,
    title: "Search across a whole project",
    detail:
      "Put all the files for one project in a folder. Open the folder and click Ask about this folder to ask questions that need information from more than one document.",
    href: "/dashboard",
    linkLabel: "Create a folder",
  },
  {
    icon: Globe,
    title: "Ask questions about a website",
    detail:
      "Paste a site address in Import. Parsed reads the pages and turns them into one document you can chat with. Great for product docs, help centres and company sites.",
    href: "/import",
    linkLabel: "Import a website",
  },
  {
    icon: Code2,
    title: "Add a support chat to your own site",
    detail:
      "Put your help docs in a folder, generate an embed script, and paste it into your website. Visitors get a chat button that answers only from that folder.",
    href: "/playground",
    linkLabel: "Try the widget",
  },
];

function StepList({ children }: { children: React.ReactNode }) {
  return (
    <ol className="ml-4 list-decimal space-y-1.5 text-muted-foreground marker:text-foreground">
      {children}
    </ol>
  );
}

function PageLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-foreground underline underline-offset-2">
      {children}
    </Link>
  );
}

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-6 pb-16">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <LifeBuoy className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">How to use</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload any document. Ask anything. This page explains how, step by step.
          </p>
        </div>
      </div>

      {/* ── The one idea ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start here: the one thing to understand</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>
            <strong>Parsed reads your documents so you can ask them questions.</strong>
          </p>
          <p className="text-muted-foreground">
            You give it a file or a website. It reads the text, breaks it into small pieces and
            indexes them. When you ask a question, it finds the pieces that match, sends them to
            an AI model, and shows you an answer together with the exact sources it used.
          </p>
          <p className="text-muted-foreground">
            The answer only comes from your documents. If the information is not in them, Parsed
            will tell you it could not find it instead of guessing.
          </p>
        </CardContent>
      </Card>

      {/* ── Setup ─────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Before you start</h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="size-4" /> Add your AI key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Parsed needs an AI key to read documents and answer questions. Go to{" "}
              <PageLink href="/settings">Settings</PageLink> and paste a Google Gemini, OpenAI or
              Anthropic key. The provider is detected from the key itself.
            </p>
            <p>
              If you use an Anthropic key, also add a Google or OpenAI key in the second field.
              Anthropic cannot create the search index, so that second key does that part.
            </p>
            <p>
              Until a key is saved, the dashboard shows a banner and chat will not work.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ── Scenarios ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">What you can use it for</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Four common ways people use Parsed. Each one is explained step by step further down.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map(({ icon: Icon, title, detail, href, linkLabel }) => (
            <Card key={title}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className="size-4" /> {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{detail}</p>
                <PageLink href={href}>{linkLabel} →</PageLink>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ── Step by step ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Step by step</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow these in order the first time. After that you will only need the parts you use.
          </p>
        </div>

        {/* 1. Upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Upload className="size-4" />
              1. Upload a document
              <Badge variant="outline" className="ml-1 text-[10px]">
                start here
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <StepList>
              <li>
                Open the <PageLink href="/dashboard">Dashboard</PageLink>.
              </li>
              <li>
                Drag a file into the upload box, or click it to choose one. PDF, Word (DOCX), TXT
                and Markdown files work, up to 50 MB each. You can drop several at once.
              </li>
              <li>
                Optional: add tags before uploading. Tags are short labels like{" "}
                <strong className="text-foreground">invoice</strong> or{" "}
                <strong className="text-foreground">2024</strong> that help you filter later.
              </li>
              <li>
                Watch the status on the file card. It goes from Uploading to Processing to{" "}
                <strong className="text-foreground">Ready</strong>. You can leave the page; it keeps
                going in the background.
              </li>
            </StepList>
            <p className="rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
              Scanned PDFs that are only pictures of text will not work. Parsed needs real text
              it can select and copy.
            </p>
          </CardContent>
        </Card>

        {/* 2. Chat with one file */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="size-4" />
              2. Ask questions about one file
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <StepList>
              <li>Click a file card on the dashboard or inside a folder.</li>
              <li>
                The file opens on the left and a chat panel on the right. Type a question and press
                Enter.
              </li>
              <li>
                Under each answer you will see <strong className="text-foreground">source</strong>{" "}
                cards. These are the exact passages the answer was built from. Hover one to read
                the text.
              </li>
              <li>
                Hover your own message to edit it and ask again, or hover an answer to copy it.
              </li>
            </StepList>
            <p className="text-muted-foreground">
              The conversation is saved with the file, so you can come back later and carry on
              where you left off.
            </p>
          </CardContent>
        </Card>

        {/* 3. Folders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FolderOpen className="size-4" />
              3. Organise with folders and ask across many files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <StepList>
              <li>
                On the <PageLink href="/dashboard">Dashboard</PageLink> click{" "}
                <strong className="text-foreground">New folder</strong>. Folders can sit inside
                other folders.
              </li>
              <li>
                Upload straight into a folder, or open a file&apos;s menu and choose{" "}
                <strong className="text-foreground">Move to folder</strong>.
              </li>
              <li>
                Open the folder and click{" "}
                <strong className="text-foreground">Ask about this folder</strong> at the top. Every ready file in that folder, including sub-folders, is used to answer.
              </li>
              <li>
                To ask across <em>everything</em> you have uploaded, use{" "}
                <PageLink href="/chat">Chat</PageLink> in the sidebar with no folder selected.
              </li>
            </StepList>
            <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
              <Tag className="mt-0.5 size-3.5 shrink-0" />
              <span>
                On the Chat page, click a tag chip at the top to narrow the answer to files with that
                tag. Click the × on a chip to remove it. Tags on the dashboard filter the file list
                the same way.
              </span>
            </p>
          </CardContent>
        </Card>

        {/* 4. Import a website */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="size-4" />
              4. Import a website
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <StepList>
              <li>
                Go to <PageLink href="/import">Import</PageLink>.
              </li>
              <li>
                Paste the site address and pick how many pages to read. Start small; you can always
                import again with a higher number.
              </li>
              <li>
                Click Import website. Progress shows live on the page. When it finishes, the whole site is
                saved as one Markdown file you can open and chat with like any other document.
              </li>
            </StepList>
            <p className="rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
              Parsed only follows links on the same site. Pages behind a login or that need
              JavaScript to load their content may come back empty.
            </p>
          </CardContent>
        </Card>

        {/* 5. Widget */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Code2 className="size-4" />
              5. Put a chat widget on your own website
              <Badge variant="outline" className="ml-1 text-[10px]">
                optional
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Let visitors to your site ask questions that are answered only from one of your
              folders. Good for help centres, product docs and FAQs.
            </p>
            <StepList>
              <li>
                Put the documents you want visitors to ask about in one folder. Only files in that
                folder are used; nothing else is visible.
              </li>
              <li>
                Open the folder and click <strong className="text-foreground">Embed widget</strong>. Click{" "}
                <strong className="text-foreground">Generate embed script</strong> and copy it.
              </li>
              <li>
                Paste the script into your website&apos;s HTML, inside the head or body. A floating
                chat button appears in the corner of every page that has it.
              </li>
              <li>
                Want to see it first? Open the{" "}
                <PageLink href="/playground">Playground</PageLink>, choose the folder and click Load
                widget. It runs right here so you can test questions before going live.
              </li>
            </StepList>
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>Regenerating the script turns off the old one.</strong>&nbsp;If you ever
              think the script has been copied somewhere it should not be, regenerate it and update
              your site with the new one.
            </p>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── File status ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">What the file status means</h2>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-[9rem] px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">What it means</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {FILE_STATUS.map(({ label, detail }) => (
                <tr key={label}>
                  <td className="px-3 py-2 align-top">
                    <Badge variant="outline">{label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Troubleshooting ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">If something looks wrong</h2>
        <div className="space-y-2 text-sm">
          <div className="rounded-md border px-4 py-3">
            <p className="font-medium">The answer says it cannot find the information</p>
            <p className="mt-1 text-muted-foreground">
              Check the file is Ready, and that your chat scope includes it. On the Chat page, the
              bar at the top shows which folder and tags are active. Clear them to search
              everything. Try asking with the same words the document uses.
            </p>
          </div>
          <div className="rounded-md border px-4 py-3">
            <p className="font-medium">A file is stuck on Processing</p>
            <p className="mt-1 text-muted-foreground">
              Large files can take a few minutes. If it never reaches Ready, delete the file and
              upload it again. If it ends in Error, open the file menu and choose Retry processing.
            </p>
          </div>
          <div className="rounded-md border px-4 py-3">
            <p className="font-medium">Chat shows an AI error</p>
            <p className="mt-1 text-muted-foreground">
              Your key may be out of credit or expired. Check it in{" "}
              <PageLink href="/settings">Settings</PageLink> and save a new one if needed.
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-muted-foreground">
              <span className="font-medium text-destructive">Deleting a file cannot be undone.</span>{" "}
              It removes the file, its search index and its chat history. Deleting a folder asks
              whether to keep its files by moving them to the top level, or delete them too.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
