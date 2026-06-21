# YannBookLM

Ein quellen-gebundener KI-Forschungsassistent — ein NotebookLM-Klon gebaut als Bewerbungsprojekt.

Die KI antwortet ausschließlich auf Basis hochgeladener Quellen (RAG). Jede Antwort enthält Inline-Zitate zurück zur Originalquelle.

## Features

- **Quellen-Upload** — PDF, Webseiten-URL, Google Drive (PDF + Google Docs)
- **RAG-Chat** — Fragen an die hochgeladenen Quellen mit Inline-Zitaten und Hover-Vorschau
- **Studio-Tools** — KI-generierte Outputs aus den Quellen:
  - Audio Overview (Podcast-Gespräch, OpenAI TTS)
  - Mind Map (interaktiver Graph via React Flow)
  - Slide Deck (Gamma-optimierter Markdown-Prompt)
  - Data Table (strukturierte Tabelle via Anthropic Structured Output)
  - Quiz (15 Multiple-Choice-Fragen mit Sofort-Feedback)
  - Flashcards (Karteikarten mit 3D-Flip-Animation)
  - Berichte (Markdown-Report)
- **Notizen** — aus Chat-Antworten übernehmen oder manuell schreiben (Tiptap-Editor)
- **Teilen** — Notebooks und Studio-Outputs über Share-Link teilen
- **Internationalisierung** — Deutsch und Englisch (next-intl)

## Tech Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | NextAuth.js v5 (Google + GitHub OAuth) |
| Datenbank | PostgreSQL + pgvector (Neon) via Drizzle ORM |
| Embeddings | Voyage AI (`voyage-4`) |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) via Vercel AI SDK |
| Storage | AWS S3 / LocalStack (Bilder, PDFs, Audio) |
| UI | shadcn/ui + Tailwind CSS + Lucide |
| Rich Text | Tiptap |
| Graph | React Flow + Dagre |
| TTS | OpenAI Polly (`alloy` + `nova`) |
| Tests | Playwright (E2E) |

## RAG-Architektur

Parent-Child Chunking: kleine Child-Chunks (256 Token) für präzises Embedding-Retrieval, große Parent-Chunks (1024 Token) für reichhaltigen LLM-Kontext.

Retrieval-Strategie: global top-20 nach Cosinus-Ähnlichkeit + top-1 Fallback pro Quelle die noch nicht vertreten ist — garantiert alle aktiven Quellen sind zitierbar, ohne Relevanz zu opfern.

## Lokales Setup

### Voraussetzungen

- Node.js 20+
- Docker (für LocalStack S3)
- PostgreSQL mit pgvector-Extension

### Umgebungsvariablen

`.env.local` anlegen (Vorlage: `.env.example` falls vorhanden):

```
# Auth
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# Datenbank
DATABASE_URL=

# KI
ANTHROPIC_API_KEY=
VOYAGE_AI_API_KEY=
OPENAI_API_KEY=

# Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_BUCKET_NAME=
AWS_ENDPOINT_URL=          # LocalStack: http://localhost:4566

# Google Drive Picker
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GOOGLE_API_KEY=
```

### Starten

```bash
# Abhängigkeiten installieren
npm install

# LocalStack S3 starten
docker compose -f docker-compose.test.yml up -d

# Datenbank migrieren
npm run db:migrate

# Dev-Server
npm run dev
```

App läuft auf [http://localhost:3000](http://localhost:3000).

### Tests

```bash
# E2E-Tests (Playwright)
npm run test:e2e
```

## Projektstruktur

```
app/                   # Next.js App Router (Pages + API Routes)
  api/                 # API Routes (chat, studio/*, sources/*, share/*)
  [locale]/app/        # Authenticated app (Notebook-View)
  share/               # Öffentliche Share-Seiten
components/
  notebook/            # Chat, Studio-Sidebar, Source-Sidebar
  sources/             # Source-Upload-Modal
  ui/                  # shadcn/ui Basiskomponenten
db/                    # Drizzle Schema + Migrationen
lib/
  ai/                  # Voyage-Embedding, Audio-Generation
  ingestion/           # PDF/Web/YouTube-Parser, Chunker
docs/
  adr/                 # Architecture Decision Records
  chat-history/        # Exportierte Session-Protokolle
```
