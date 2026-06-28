# YannBookLM

Ein quellen-gebundener KI-Forschungsassistent — inspiriert von [NotebookLM](https://notebooklm.google.com/).

Die KI antwortet **ausschließlich auf Basis hochgeladener Quellen** (RAG). Jede Antwort enthält nummerierte Inline-Zitate mit Hover-Vorschau, die direkt zur Originalstelle in der Quelle springen.

---

## Features

### Authentifizierung

- Google OAuth und GitHub OAuth via NextAuth.js v5
- Session-basiertes Auth mit Drizzle Adapter

### Notebooks

- Dashboard mit allen Notebooks des Users
- Notebook erstellen, umbenennen, löschen
- Jedes Notebook ist ein isolierter Arbeitsbereich mit eigenen Quellen, Chat, Notizen und Studio-Outputs

### Quellen-Ingestion

#### PDF-Upload

- Drag & Drop oder File Picker im Sources-Panel
- Rohdatei wird direkt auf AWS S3 hochgeladen (Presigned URL)
- Asynchrone Verarbeitung via Vercel Background Function:
  - Textextraktion mit `pdfjs-dist`
  - Bildextraktion mit `mupdf` — Bilder werden auf S3 gespeichert und im Quellen-Viewer angezeigt
  - Parent-Child Chunking (Child: 256 Token für Retrieval, Parent: 1024 Token für LLM-Kontext)
  - Embeddings mit Voyage AI `voyage-4` → gespeichert in pgvector
- Status-Anzeige: `pending` → `processing` → `ready` (Polling mit Live-Update)

#### Web-URL Ingestion

- URL eingeben → Text via `@mozilla/readability` + jsdom extrahiert
- Fallback auf Jina AI Reader API bei JavaScript-heavy Seiten
- Gleiche Chunking + Embedding-Pipeline wie PDF

#### YouTube-Ingestion

- YouTube-URL eingeben → Transkript via `youtube-transcript` geladen
- Timestamps werden als Metadaten gespeichert
- Gleiche Chunking + Embedding-Pipeline

#### Google Drive Picker

- Direkt aus dem Quellen-Modal: Google Drive Picker öffnen
- Unterstützt PDF und Google Docs (wird als PDF exportiert)
- Client-seitiger Download via Drive API + Google Identity Services (OAuth `drive.readonly`)

#### Source-Filter

- Checkbox neben jeder Quelle im Sources-Panel
- Deaktivierte Quellen werden beim RAG-Retrieval vollständig ausgeschlossen
- Toggle sofort wirksam (Optimistic Update, PATCH im Hintergrund)
- Quellen-Zähler im Chat-Eingabefeld zeigt aktive Quellen

### RAG-Chat

- Fragen an die hochgeladenen Quellen stellen
- **Hybrid-Retrieval**: global top-20 nach Cosinus-Ähnlichkeit + top-1 Fallback pro Quelle nicht im globalen Pool — garantiert alle aktiven Quellen sind zitierbar, ohne Relevanz zu opfern
- Streaming-Antworten via Vercel AI SDK (`streamText`)
- **Inline-Zitate**: nummerierte Badges `[1]` `[2]` direkt im Fließtext, in Reihenfolge des ersten Vorkommens
  - Hover über Badge: Vorschau mit Quelltitel + Textausschnitt
  - Klick auf Badge: Quellen-Detailansicht öffnet sich und scrollt automatisch zur zitierten Stelle
  - Ab 3 Badges kollabierbar mit `···`
- **Chat-Konfiguration**: Modus (Standard / Lernmodus / Benutzerdefiniert) und Antwortlänge einstellbar
- **Chat-Verlauf**: persistiert in DB; Zitate werden beim Neuladen korrekt wiederhergestellt
- **Action Buttons** pro Antwort: "In Notizen speichern" und Kopieren (ohne Zitat-Marker)
- Chat-Verlauf löschen

### Notizen

- Neue Notiz manuell erstellen (Tiptap Rich-Text-Editor mit Link-Support)
- Aus Chat-Antwort übernehmen — Text ohne `[N]`-Marker, automatischer Titel aus den ersten 60 Zeichen
- Notizen umbenennen, bearbeiten, löschen

### Studio-Tools

Alle Studio-Tools sind über das Studio-Panel zugänglich. Ein Klick ohne aktive Quellen sendet den Tool-Namen als Chat-Nachricht und das LLM erklärt das Feature.

#### Audio Overview

- Claude generiert ein Podcast-Dialogskript aus den Quellen (JSON: `[{speaker: "A"|"B", text}]`)
- OpenAI TTS vertont es mit zwei Stimmen: Host A (`alloy`), Host B (`nova`)
- Audio-Segmente werden auf S3 gespeichert und clientseitig zu einer Datei zusammengefügt
- In-App-Player mit Play/Pause und Fortschrittsbalken + Download

#### Mind Map

- Claude generiert Graphstruktur als JSON `{nodes, edges}`
- Interaktiver Canvas mit React Flow + Dagre Auto-Layout
- Zoom, Pan, Drag; Node-Klick zeigt Beschreibung
- PNG-Export

#### Slide Deck

- Claude generiert Gamma-optimierten Markdown-Prompt (Slides getrennt durch `---`)
- Kopieren-Button für direkten Import in [Gamma.app](https://gamma.app)
- In-App-Viewer mit Slide-Navigation
- Google Slides Export via Gamma-API

#### Data Table

- Claude extrahiert strukturierte Daten aus Quellen (Anthropic Structured Output)
- Output: `{title, headers: string[], rows: string[][]}`
- Sortierbar nach jeder Spalte (client-seitig)
- CSV-Export

#### Quiz

- Claude generiert 15 Multiple-Choice-Fragen (A/B/C/D) aus den Quellen
- Sofort-Feedback nach jeder Antwort mit Kontext-Erklärung
- Ergebnis-Screen mit Kreisring-Fortschritt
- "Nochmal üben" mit Dropdown: alle Fragen, nur falsche, nur richtige

#### Karteikarten / Flashcards

- Claude generiert 50 Karteikarten (Vorderseite / Rückseite) aus den Quellen
- 3D-Flip-Animation (CSS perspective transform)
- Selbstbewertung: "Gewusst" / "Nicht gewusst"
- Ergebnis-Screen mit Kreisring, Nochmal-üben-Dropdown
- "Behandelte Themen" Chip-Liste + "Weiterlernen"-Vorschläge

#### Berichte

- Format-Auswahl beim ersten Klick: Eigener Bericht, Überblick, Zusammenfassung, Stärken & Schwächen, Vergleich, Argumentationsanalyse oder Freitext
- Claude generiert strukturierten Fließtext-Bericht (Markdown)

### Quellen-Detailansicht

- Klick auf ein Zitat-Badge öffnet die Quellen-Detailansicht
- Zeigt die gesamte Quelle (nicht nur den zitierten Chunk)
- Scrollt automatisch zur zitierten Stelle und hebt sie hervor

### Teilen

- Notebooks und einzelne Studio-Outputs über Share-Link teilen
- Share-Seite rendert alle Output-Typen (Audio, Mind Map, Slide Deck, Tabelle, Quiz, Karteikarten, Bericht)
- Share-Scope einstellbar: öffentlich oder deaktiviert

### UX

- **3-Panel-Layout**: Sources-Panel | Chat | Studio/Notizen — alle Panels kollabierbar mit Quick-Access-Icons
- **Dark Mode** — System-Präferenz + manueller Toggle
- **Internationalisierung**: Deutsch und Englisch via next-intl

---

## Tech Stack

| Bereich      | Technologie                                            |
| ------------ | ------------------------------------------------------ |
| Framework    | Next.js 15 (App Router)                                |
| Auth         | NextAuth.js v5 (Google + GitHub OAuth)                 |
| Datenbank    | PostgreSQL + pgvector (Neon) via Drizzle ORM           |
| Embeddings   | Voyage AI `voyage-4`                                   |
| LLM          | Anthropic Claude `claude-sonnet-4-6` via Vercel AI SDK |
| Storage      | AWS S3 / LocalStack (Bilder, PDFs, Audio)              |
| UI           | shadcn/ui + Tailwind CSS + Lucide Icons                |
| Rich Text    | Tiptap                                                 |
| Graph        | React Flow + Dagre                                     |
| TTS          | OpenAI TTS (`alloy` + `nova`)                          |
| PDF-Parsing  | pdfjs-dist + mupdf                                     |
| Web-Scraping | @mozilla/readability + Jina AI                         |
| YouTube      | youtube-transcript                                     |
| Google Drive | Google Picker API + Google Identity Services           |
| Tests        | Playwright (E2E)                                       |

---

## RAG-Architektur

**Parent-Child Chunking:** Kleine Child-Chunks (256 Token) für präzises Embedding-Retrieval, große Parent-Chunks (1024 Token) für reichhaltigen LLM-Kontext. Das LLM sieht immer den Parent-Chunk, zitiert aber anhand des Child-Chunks.

**Hybrid-Retrieval:**

1. Global top-20 nach Cosinus-Ähnlichkeit zu pgvector — hochrelevante Chunks aus den ähnlichsten Quellen
2. Top-1 Fallback pro aktiver Quelle, die noch nicht im globalen Pool vertreten ist

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
docker compose -f docker-compose.test.yml up -d
npm run db:migrate
npm run dev
```

App läuft auf [http://localhost:3000](http://localhost:3000).

### Tests

```bash
npm run test:e2e
```
