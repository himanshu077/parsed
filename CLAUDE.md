# Parsed — Project Rules

## What is Parsed

AI-powered document chat tool. Upload PDF, DOCX, TXT, or Markdown files (or import a website) — ask anything about them.
Parsed extracts text, embeds it into Pinecone, and uses a configurable LLM (Ollama by default) to answer questions with source citations.

**Tagline:** Upload any document. Ask anything.

---

## Key Documents

| Document | Path |
|---|---|
| Product Spec | `docs/product-spec.md` |
| App Implementation | `docs/app-implementation.md` |
| Tech Stack | `docs/tech-stack.md` |
| MCP Setup | `docs/mcp-setup.md` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui (new-york, neutral, CSS variables) |
| Auth | Better Auth (email/password, Google OAuth, Resend reset email) |
| Database | PostgreSQL via Neon + Drizzle ORM |
| File Storage | Vercel Blob |
| Vector DB | Pinecone (index: `parsed`, cosine, dims match embedding provider) |
| Embeddings | Configurable: `EMBEDDING_PROVIDER` = openai \| google \| ollama (default **ollama** `nomic-embed-text`, 768d) |
| LLM | Configurable: `LLM_PROVIDER` = anthropic \| openai \| google \| ollama (default **ollama** `llama3.1:8b`) |
| AI Streaming | Vercel AI SDK (`ai` v6) |
| Background Jobs | Inngest (file processing, website crawl) |
| Realtime | Pusher (upload/crawl progress) |
| Package Manager | npm |
| Deployment | Vercel or self-hosted EC2 (Ollama) |

---

## Folder Structure

```
src/
├── app/
│   ├── auth/                            # Auth pages (sign-in, sign-up, forgot/reset password)
│   ├── (app)/
│   │   ├── layout.tsx                   # App shell with sidebar
│   │   ├── dashboard/page.tsx           # Dashboard
│   │   ├── folders/[id]/page.tsx        # Folder view
│   │   ├── files/[id]/page.tsx          # File view + chat panel
│   │   ├── chat/page.tsx                # Multi-file chat
│   │   └── import/page.tsx              # URL / website import
│   └── api/
│       ├── auth/[...all]/route.ts       # Better Auth handler
│       ├── folders/route.ts             # GET list, POST create
│       ├── folders/[id]/route.ts        # GET, PUT, DELETE
│       ├── folders/[id]/widget-token/   # GET/POST embeddable-widget token
│       ├── files/route.ts               # GET list, POST upload
│       ├── files/[id]/route.ts          # GET, PATCH (move), DELETE
│       ├── files/[id]/process/route.ts  # POST re-embed (via Inngest)
│       ├── chat/route.ts                # POST streaming RAG
│       ├── chats/route.ts               # GET/POST chat sessions
│       ├── chats/[id]/messages/route.ts # GET paginated history
│       ├── import-url/route.ts          # POST start crawl, GET jobs
│       ├── import-url/[id]/route.ts     # GET job status
│       ├── widget/chat/route.ts         # POST public widget RAG (token-scoped)
│       └── inngest/route.ts             # Inngest serve (processFile, crawlWebsite)
│
├── components/
│   ├── ui/                              # shadcn auto-generated — never edit manually
│   ├── layout/                          # AppShell, AppSidebar, Header, FolderTree
│   ├── folders/                         # FolderCard, FolderMoveModal, EmbedButton, …
│   ├── files/                           # FileUploader, FileCard, FileViewer, PDFViewer, …
│   └── chat/                            # ChatPanel, ChatMessage, ChatScopeBar, SourceCard, ChatInput
│
├── lib/
│   ├── ai/                              # Provider-agnostic AI layer
│   │   ├── config.ts                    # LLM/embedding provider + model + temperature config
│   │   ├── llm.ts                       # getLLMModel() — anthropic|openai|google|ollama
│   │   └── embeddings.ts                # embedTexts() — openai|google|ollama
│   ├── auth.ts                          # Better Auth server config
│   ├── auth-client.ts                   # Better Auth client
│   ├── database.ts                      # Drizzle client (Neon / postgres.js)
│   ├── utils.ts                         # cn() and helpers
│   ├── pinecone.ts                      # Pinecone client + upsert/query/delete helpers
│   ├── embeddings.ts                    # Re-export of lib/ai/embeddings
│   ├── hybrid-search.ts                 # Vector + Postgres FTS merged via RRF
│   ├── rag.ts                           # retrieveContext + rerank + buildSystemPrompt
│   ├── tokens.ts                        # Token-budget trimming
│   ├── chunker.ts                       # Text chunking (1500 chars, 200 overlap)
│   ├── crawler.ts                       # BFS website crawler (cheerio)
│   ├── extractor.ts                     # Page extraction + site markdown compile
│   ├── inngest.ts                       # Inngest client
│   ├── pusher.ts / pusher-client.ts     # Realtime progress
│   ├── email.ts                         # Resend password-reset email
│   ├── storage.ts                       # Vercel Blob upload/delete
│   └── parsers/
│       ├── index.ts                     # Router: pdf|docx|txt|md|web
│       ├── pdf.ts                       # unpdf wrapper
│       ├── docx.ts                      # mammoth wrapper
│       └── text.ts                      # TXT / MD / web reader
│
├── inngest/
│   ├── process-file.ts                  # File processing background job
│   └── crawl-website.ts                 # Website crawl background job
│
├── db/
│   ├── schema.ts                        # App schema (folders, files, file_chunks, chats, chat_messages, web_crawl_jobs)
│   └── auth-schema.ts                   # Better Auth generated — never edit manually
│
├── hooks/                              # useFiles, useFolders, useImportUrl, use-debounce, …
├── providers/                          # QueryProvider (TanStack Query)
├── types/                              # Domain types + barrel
└── proxy.ts                            # Auth route protection (Next 16 convention)
```

---

## Database Schema

```
folders       — id, userId, name, parentId (self-ref FK, null = root), widgetToken (unique), createdAt, updatedAt
files         — id, userId, folderId (null = root), name, originalName, type, size, blobUrl, status, tags[], errorMessage, createdAt, updatedAt
file_chunks   — id, fileId, chunkIndex, content, pineconeId, createdAt
chats         — id, userId, title, createdAt, updatedAt
chat_messages — id, chatId, role (user|assistant), content, sources (JSON, null for user), createdAt
web_crawl_jobs— id, userId, folderId, rootUrl, status, totalPages, processedPages, fileId, errorMessage, createdAt, updatedAt
```

`files.type` values: `pdf` | `docx` | `txt` | `md` | `web`
`files.status` values: `uploading` → `processing` → `ready` | `error`
`web_crawl_jobs.status` values: `pending` → `crawling` → `processing` → `done` | `error`

Auth tables in `src/db/auth-schema.ts` (users, sessions, accounts, verifications) — managed by Better Auth, never edit manually.

Drizzle config: snake_case, schemas from `src/db/schema.ts` + `src/db/auth-schema.ts`, migrations in `./migrations`.

---

## Pinecone

Index: `parsed` — cosine metric, namespace per user (`userId`).
**Dimensions must match the active embedding provider**: 768 for `ollama`/`google` defaults, 1536 for `openai`. Default self-host deployments use 768 (`nomic-embed-text`).

Vector metadata per chunk:
```
fileId, fileName, fileType, folderId, folderPath, chunkIndex, tags[], size,
preview (first 200 chars), content (full chunk text), pageUrl (web-crawl chunks only)
```

---

## File Processing Pipeline

```
Upload → Vercel Blob → Inngest event "file/uploaded" → processFile job:
  mark-processing → download → parse → chunk → resolve folder path →
  delete existing chunks → embed → Pinecone upsert → save chunks → status = ready
```

Runs as an **Inngest** background job (`src/inngest/process-file.ts`), with live progress over **Pusher** (`file-${fileId}`). Re-process via `POST /api/files/[id]/process` (re-fires the same event).

Parser routing by file type (`src/lib/parsers/`):
- `.pdf`  → `unpdf`
- `.docx` → `mammoth`
- `.txt` / `.md` / `web` → `TextDecoder`

Website import: `POST /api/import-url` → Inngest `url/crawl.start` → `crawlWebsite` (BFS crawl via cheerio, one compiled `.md` file, per-chunk `pageUrl` attribution), progress over Pusher (`crawl-${jobId}`).

Always check `file.status === "ready"` before allowing chat on a file.

### Retrieval (RAG)
`retrieveContext` (`src/lib/rag.ts`) runs **hybrid search** (`src/lib/hybrid-search.ts`): Pinecone vector (topK 15) + Postgres full-text (topK 10), merged via **Reciprocal Rank Fusion** (k=60) → optional **Jina rerank** (if `JINA_API_KEY` set; final top-K 5) → token-budget trim (~6000 tokens) → `streamText` with the configured provider at `LLM_TEMPERATURE`. Chat sessions + messages are persisted (`chats`, `chat_messages`).

---

## API Routes

```
GET   /api/files                    → list files (?folderId=)
POST  /api/files                    → upload (multipart/form-data) + trigger Inngest processing
GET   /api/files/:id                → metadata + status
PATCH /api/files/:id                → move file { folderId }
DEL   /api/files/:id                → delete file + Blob + Pinecone vectors
POST  /api/files/:id/process        → re-trigger processing (via Inngest)

GET   /api/folders                  → full folder tree for authed user
POST  /api/folders                  → create { name, parentId? }
PUT   /api/folders/:id              → rename { name }
DEL   /api/folders/:id              → { strategy: "move-to-root" | "delete-all" }
GET   /api/folders/:id/widget-token → get embeddable-widget token
POST  /api/folders/:id/widget-token → (re)generate widget token

POST  /api/chat                     → streaming RAG (UIMessage stream)
                                       body: { messages, fileIds?, chatId? }
GET   /api/chats                    → list chat sessions
POST  /api/chats                    → create chat session
GET   /api/chats/:id/messages       → paginated history (?before=)

POST  /api/import-url               → start website crawl { url, maxPages? } → { jobId }
GET   /api/import-url               → recent crawl jobs
GET   /api/import-url/:id           → job status + fileId

POST  /api/widget/chat              → public folder-scoped RAG (token auth, CORS)
*     /api/inngest                  → Inngest serve (processFile, crawlWebsite)
```

Note: folder/tag chat scope is resolved to a concrete `fileIds[]` client-side before calling `/api/chat`.

---

## Conventions

### Components
- Add shadcn components via CLI: `npx shadcn@latest add <component>`
- Never edit `src/components/ui/` manually
- Every component folder has an `index.ts` barrel re-exporting all named exports
- Import from barrel, never from the file directly:
  ```ts
  import { FileCard } from "@/components/files"          // correct
  import { FileCard } from "@/components/files/FileCard" // avoid
  ```
- Use `cn()` from `@/lib/utils` for all class merging — never string concatenation

### Drizzle ORM
- Schema files: `src/db/schemas/*.schema.ts` → re-exported from `src/db/schema.ts`
- Always export `$inferSelect` and `$inferInsert` types
- Migration workflow: edit schema → `npm run db:generate` → `npm run db:migrate`
- Casing: snake_case (configured in `drizzle.config.ts`)

### Better Auth
- Server: `src/lib/auth.ts` — Drizzle adapter
- Client: `src/lib/auth-client.ts` — `createAuthClient`
- API route: `src/app/api/auth/[...all]/route.ts`
- Auth tables always in `src/db/auth-schema.ts` — generated, not handwritten

### Database Connection
- `src/lib/database.ts` auto-detects Neon vs local Postgres by URL
- Neon URL (contains `neon.tech`) → `@neondatabase/serverless` HTTP driver
- Local URL → `postgres.js` with connection pooling

---

## Scripts

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run lint          # ESLint
npm run ts:check      # TypeScript check (no emit)
npm run db:generate   # Generate migration files from schema changes
npm run db:migrate    # Apply migrations to the database
# Never use db:push — always use generate + migrate
npm run db:studio     # Drizzle Studio
npm run auth:generate # Regenerate Better Auth schema
```

---

## Environment Variables

```bash
# Database / Auth / Storage
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
NEXT_PUBLIC_APP_URL=
BLOB_READ_WRITE_TOKEN=

# AI providers (default: ollama, local — no keys needed)
LLM_PROVIDER=ollama            # anthropic | openai | google | ollama
LLM_MODEL=llama3.1:8b
LLM_TEMPERATURE=0.3
EMBEDDING_PROVIDER=ollama      # openai | google | ollama
EMBEDDING_MODEL=nomic-embed-text
OLLAMA_BASE_URL=http://localhost:11434
JINA_API_KEY=                  # optional — enables reranking
# Provider keys (only for the provider(s) you use)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

# Vector DB
PINECONE_API_KEY=
PINECONE_INDEX_NAME=parsed

# OAuth / Email
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=

# Background jobs (Inngest) + Realtime (Pusher)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
INNGEST_DEV=
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
```

---

## MCP — Context7

Context7 resolves up-to-date library docs on demand.
Config: `.mcp.json` (Claude Code) + `.cursor/mcp.json` (Cursor) — both at project root.

**Lookup order:**
1. Use existing knowledge if confident
2. Query Context7 if unsure about a library API or behavior
3. Web search only if Context7 does not resolve it

Do not web search for anything covered by the libraries listed below.

| Library | Context7 URL |
|---|---|
| Next.js | `https://context7.com/vercel/next.js` |
| Better Auth | `https://context7.com/better-auth/better-auth` |
| shadcn/ui | `https://context7.com/shadcn-ui/ui` |
| React | `https://context7.com/websites/react_dev` |
| Drizzle ORM | `https://context7.com/drizzle-team/drizzle-orm-docs` |
| Tailwind CSS | `https://context7.com/tailwindlabs/tailwindcss.com` |
| TanStack Query | `https://context7.com/websites/tanstack_query` |
| Zod | `https://context7.com/websites/zod_dev` |
| Vercel AI SDK | `https://context7.com/vercel/ai` |
| Pinecone | `https://context7.com/pinecone-io/pinecone-ts-client` |

---

## Modes

### Default Mode
Used unless explicitly told otherwise. All standard rules apply.

### Strict Mode
Activated when the user writes any of: `STRICT` `CRITICAL CHANGE` `REFACTOR CORE` `BUG INVESTIGATION MODE`

**Pre-change:**
- Grep ALL usages before modifying shared functions, components, types, or configs
- Trace the full execution path
- Identify upstream and downstream impact
- Verify framework behavior if not 100% certain

**During change:**
- Modify only what is necessary
- Maintain backward compatibility unless explicitly told to break it
- Match existing patterns exactly

**Post-change:**
- Verify all call sites still work
- Check for unused imports, dead references, broken dependencies
- If bulk edit, confirm old patterns no longer exist
- Show proof (grep results, logs, test output)

---

## Priority Order

When making decisions or trade-offs, apply in this order:

1. **Correctness** — does it work correctly?
2. **Root cause** — is the actual problem solved, not just the symptom?
3. **Minimal change surface** — fewest files and lines touched
4. **Codebase consistency** — matches existing patterns
5. **Performance** — only optimise when correctness is confirmed

---

## AI Rules

### Verification
- After any find-and-replace or bulk edit, grep for both old and new patterns to confirm all occurrences changed. Never report done without a verification search.
- After modifying code, check for unused imports, dead references, and broken dependencies.
- When fixing a bug, trace the full execution path before writing code. Do not assume how the framework calls your code — verify it.

### Communication
- No fluff. No emojis unless asked. Just answer.
- Do not explain what you're about to do — just do it. Narrate only when the user needs to make a decision.
- If the user is incorrect, correct them directly.
- When reporting changes, show proof (grep results, test output) not just claims.

### Research Priority (follow this order — do not skip steps)

1. **Use existing knowledge first.** If confident about the answer, just answer. Do not look anything up.
2. **Check Context7 second.** If unsure about a library API, signature, or behavior — query Context7 before anything else. Do not web search first.
3. **Web search last resort only.** Only if Context7 does not resolve the question. Do not default to web search.

Never run a search for something you already know. Every unnecessary lookup adds latency and token cost.

### Problem Solving
- Fix the root cause, not symptoms. If a fix fails on first try, stop and re-analyze before retrying.
- Before implementing, identify all locations that need changes (grep first, edit second). Partial fixes are worse than no fix.

### Code Quality
- Match existing code style, patterns, and conventions. Do not introduce new patterns unless explicitly asked.
- Prefer the simplest solution. No abstractions or utilities for one-time operations.
- Do not add comments, docstrings, or type annotations to code you didn't change.

### Workflow
- Read before edit. Always.
- One problem at a time. Do not bundle unrelated changes.
- Verify each step works before moving to the next.

### Interpreting User Intent
- Understand the intent, not just the literal words. If genuinely ambiguous, ask one clarifying question.
- If a request would break existing functionality, flag it before implementing.
- Do not silently add scope beyond what was asked. Mention it briefly and let the user decide.

### Protecting Existing Code
- Do not delete or rewrite code you don't fully understand. Read more context first.
- When touching a function, check who calls it. When touching a component, check who renders it.
- Grep for all usages before changing function signatures.
