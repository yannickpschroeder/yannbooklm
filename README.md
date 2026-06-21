# YannBookLM

Ein quellen-gebundener KI-Forschungsassistent — ein [NotebookLM](https://notebooklm.google.com/)-Klon, gebaut als Bewerbungsprojekt.

Die KI antwortet **ausschließlich auf Basis hochgeladener Quellen** (RAG). Jede Antwort enthält nummerierte Inline-Zitate mit Hover-Vorschau, die direkt zur Originalstelle in der Quelle springen.

---

## Features

### Authentifizierung (Issue #3)
- Google OAuth und GitHub OAuth via NextAuth.js v5
- Session-basiertes Auth mit Drizzle Adapter

### Notebooks (Issue #4)
- Dashboard mit allen Notebooks des Users
- Notebook erstellen, umbenennen, löschen
- Jedes Notebook ist ein isolierter Arbeitsbereich mit eigenen Quellen, Chat, Notizen und Studio-Outputs

### Quellen-Ingestion

#### PDF-Upload (Issue #5)
- Drag & Drop oder File Picker im Sources-Panel
- Rohdatei wird direkt auf AWS S3 hochgeladen (Presigned URL)
- Asynchrone Verarbeitung via Vercel Background Function:
  - Textextraktion mit `pdfjs-dist`
  - Bildextraktion mit `mupdf` — Bilder werden ebenfalls auf S3 gespeichert und im Quellen-Viewer angezeigt
  - Parent-Child Chunking (Child: 256 Token für Retrieval, Parent: 1024 Token für LLM-Kontext)
  - Embeddings mit Voyage AI `voyage-4` → gespeichert in pgvector
- Status-Anzeige: `pending` → `processing` → `ready` (Polling mit Live-Update)

#### Web-URL Ingestion (Issue #6)
- URL eingeben → Text via `@mozilla/readability` + jsdom extrahiert
- Fallback auf Jina AI Reader API bei JavaScript-heavy Seiten
- Gleiche Chunking + Embedding-Pipeline wie PDF

#### YouTube-Ingestion (Issue #7)
- YouTube-URL eingeben → Transkript via `youtube-transcript` geladen
- Timestamps werden als Metadaten gespeichert (für zukünftige Sprungmarken)
- Gleiche Chunking + Embedding-Pipeline

#### Google Drive Picker
- Direkt aus dem Quellen-Modal: Google Drive Picker öffnen
- Unterstützt PDF und Google Docs (wird als PDF exportiert)
- Client-seitiger Download via Drive API + Google Identity Services (OAuth `drive.readonly`)

#### Source-Filter (Issue #15)
- Checkbox neben jeder Quelle im Sources-Panel
- Deaktivierte Quellen werden beim RAG-Retrieval vollständig ausgeschlossen
- Toggle sofort wirksam (Optimistic Update, PATCH im Hintergrund)
- Quellen-Zähler im Chat-Eingabefeld zeigt aktive Quellen

### RAG-Chat (Issue #8)
- Fragen an die hochgeladenen Quellen stellen
- **Hybrid-Retrieval**: global top-20 nach Cosinus-Ähnlichkeit + top-1 Fallback pro Quelle nicht im globalen Pool — garantiert alle aktiven Quellen sind zitierbar, ohne Relevanz zu opfern
- Streaming-Antworten via Vercel AI SDK (`streamText`)
- **Inline-Zitate**: nummerierte Badges `[1]` `[2]` direkt im Fließtext, in Reihenfolge des ersten Vorkommens
  - Hover über Badge: Vorschau mit Quelltitel + Textausschnitt
  - Klick auf Badge: Quellen-Detailansicht öffnet sich und scrollt zur zitierten Stelle
  - Unterstützt mehrere Quellen pro Aussage: `[1][2][3]`, ab 3 Badges kollabierbar mit `···`
- **Chat-Konfiguration**: Modus (Standard / Lernmodus / Benutzerdefiniert) und Antwortlänge einstellbar
- **Chat-Verlauf**: persistiert in DB; Zitate werden beim Neuladen korrekt wiederhergestellt
- **Action Buttons** (Issue #24) pro Antwort:
  - "In Notizen speichern" — erste 60 Zeichen als Notiz-Titel
  - Kopieren-Button — Antwort (ohne Zitat-Marker) in Zwischenablage
- Chat-Verlauf löschen

### Notizen (Issue #9)
- Notizen-Panel als Teil des Studio-Bereichs
- Neue Notiz manuell erstellen (Tiptap Rich-Text-Editor)
- Aus Chat-Antwort übernehmen — Text ohne `[N]`-Marker, automatischer Titel aus den ersten 60 Zeichen
- Notizen umbenennen, bearbeiten, löschen
- Volltext-Editor mit Link-Support

### Studio-Tools

Alle Studio-Tools sind über das Studio-Panel zugänglich. Ein Klick ohne aktive Quellen sendet den Tool-Namen als Chat-Nachricht und das LLM erklärt das Feature.

#### Audio Overview (Issue #10)
- Claude generiert ein Podcast-Dialogskript aus den Quellen (JSON: `[{speaker: "A"|"B", text}]`)
- OpenAI TTS vertont es mit zwei Stimmen: Host A (`alloy`), Host B (`nova`)
- Audio-Segmente werden auf S3 gespeichert und clientseitig zu einer Datei zusammengefügt
- Audio-Player mit Play/Pause und Fortschrittsbalken
- In-App-Player + Download

#### Mind Map (Issue #11)
- Claude generiert Graphstruktur als JSON `{nodes, edges}`
- Interaktiver Canvas mit React Flow + Dagre Auto-Layout
- Zoom, Pan, Drag; Node-Klick zeigt Beschreibung
- PNG-Export

#### Slide Deck (Issue #12)
- Claude generiert Gamma-optimierten Markdown-Prompt (Slides getrennt durch `---`)
- Kopieren-Button für direkten Import in [Gamma.app](https://gamma.app)
- "Diashow starten" — öffnet In-App-Viewer mit Slide-Navigation (kein externer Tab)
- Google Slides Export via Gamma-API

#### Data Table (Issue #13)
- Claude extrahiert strukturierte Daten aus Quellen (Anthropic Structured Output)
- Output: `{title, headers: string[], rows: string[][]}`
- Sortierbar nach jeder Spalte (client-seitig)
- CSV-Export

#### Quiz (Issue #14)
- Claude generiert 15 Multiple-Choice-Fragen (A/B/C/D) aus den Quellen
- Sofort-Feedback nach jeder Antwort mit Kontext-Erklärung
- Ergebnis-Screen mit Kreisring-Fortschritt
- "Nochmal üben" mit Dropdown: alle Fragen, nur falsche, nur richtige

#### Karteikarten / Flashcards (Issue #20)
- Claude generiert 50 Karteikarten (Vorderseite / Rückseite) aus den Quellen
- 3D-Flip-Animation (CSS perspective transform)
- Selbstbewertung: "Gewusst" / "Nicht gewusst"
- Ergebnis-Screen mit Kreisring, Nochmal-üben-Dropdown
- "Behandelte Themen" Chip-Liste + "Weiterlernen"-Vorschläge

#### Berichte (Issue #22)
- Format-Auswahl-Modal beim ersten Klick:
  - Direktformate: Eigener Bericht, Überblick, Zusammenfassung, Stärken & Schwächen, Vergleich, Argumentationsanalyse
  - Eigene Beschreibung (Freitext)
- Claude generiert strukturierten Fließtext-Bericht (Markdown)
- Bericht wird in der Share-Seite korrekt gerendert

### Quellen-Detailansicht (Issue #23)
- Klick auf ein Zitat-Badge öffnet die Quellen-Detailansicht
- Zeigt die **gesamte Quelle** (nicht nur den Parent-Chunk)
- Scrollt automatisch zur zitierten Stelle und hebt sie hervor

### Teilen
- Notebooks und einzelne Studio-Outputs über Share-Link teilen
- Share-Seite rendert alle Output-Typen (Audio, Mind Map, Slide Deck, Tabelle, Quiz, Karteikarten, Bericht)
- Share-Scope einstellbar: öffentlich oder deaktiviert

### UX
- **3-Panel-Layout** (Issue #18): Sources-Panel | Chat | Studio/Notizen — alle Panels kollabierbar
- **Dark Mode** — System-Präferenz + manueller Toggle
- **Internationalisierung** (Issue #16): Deutsch und Englisch via next-intl
- Quick-Access-Icons in kollabierten Sidebars
- Tinted Buttons und Icon-Farben für Studio-Tools

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | NextAuth.js v5 (Google + GitHub OAuth) |
| Datenbank | PostgreSQL + pgvector (Neon) via Drizzle ORM |
| Embeddings | Voyage AI `voyage-4` |
| LLM | Anthropic Claude `claude-sonnet-4-6` via Vercel AI SDK |
| Storage | AWS S3 / LocalStack (Bilder, PDFs, Audio) |
| UI | shadcn/ui + Tailwind CSS + Lucide Icons |
| Rich Text | Tiptap |
| Graph | React Flow + Dagre |
| TTS | OpenAI TTS (`alloy` + `nova`) |
| PDF-Parsing | pdfjs-dist + mupdf |
| Web-Scraping | @mozilla/readability + Jina AI |
| YouTube | youtube-transcript |
| Google Drive | Google Picker API + Google Identity Services |
| Tests | Playwright (E2E) |

---

## RAG-Architektur

**Parent-Child Chunking:** Kleine Child-Chunks (256 Token) für präzises Embedding-Retrieval, große Parent-Chunks (1024 Token) für reichhaltigen LLM-Kontext. Das LLM sieht immer den Parent-Chunk, zitiert aber anhand des Child-Chunks.

**Hybrid-Retrieval:**
1. Global top-20 nach Cosinus-Ähnlichkeit zu pgvector — hochrelevante Chunks aus den ähnlichsten Quellen
2. Top-1 Fallback pro aktiver Quelle die noch nicht im globalen Pool vertreten ist

So dominieren relevante Quellen den Kontext, aber kein Dokument wird vollständig ausgeschlossen, nur weil eine andere Quelle ähnlicher zur Anfrage ist.

---

## Lokales Setup

### Voraussetzungen

- Node.js 20+
- Docker (für LocalStack S3)
- PostgreSQL mit pgvector-Extension

### Umgebungsvariablen

`.env.local` anlegen:

```env
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
npm install

# LocalStack S3 starten
docker compose -f docker-compose.test.yml up -d

# Datenbank migrieren
npm run db:migrate

npm run dev
```

App läuft auf [http://localhost:3000](http://localhost:3000).

### Tests

```bash
npm run test:e2e
```

---

## Projektstruktur

```
app/
  api/
    chat/              # RAG-Chat (Streaming, Zitat-Persistenz)
    studio/            # Audio, MindMap, Slides, Table, Quiz, Flashcards, Report
    sources/           # Upload, Ingestion-Trigger, Toggle
    share/             # Share-Token-Validierung
  [locale]/app/        # Authenticated App (Notebook-View)
  share/               # Öffentliche Share-Seiten
components/
  notebook/            # Chat, Studio-Sidebar, Source-Sidebar, Notizen
  sources/             # Source-Upload-Modal (PDF, URL, YouTube, Drive)
  ui/                  # shadcn/ui Basiskomponenten
db/                    # Drizzle Schema + Migrationen
lib/
  ai/                  # Voyage-Embedding, Audio-Generation
  ingestion/           # PDF/Web/YouTube-Parser, Chunker
  google-drive-picker  # Drive Picker API
docs/
  adr/                 # Architecture Decision Records
  chat-history/        # Exportierte Session-Protokolle
tests/                 # Playwright E2E-Tests
```
