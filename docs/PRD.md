# Product Requirements Document — YannBookLM

**Typ:** Bewerbungsprojekt (NotebookLM-Klon)  
**Stack:** TypeScript · Next.js · Drizzle ORM · PostgreSQL + pgvector (Supabase) · Anthropic API · Voyage AI · AWS S3 · Vercel  
**Status:** MVP in Planung

---

## 1. Ziel

YannBookLM ist ein quellen-gebundener KI-Forschungsassistent. Die KI antwortet ausschließlich auf Basis vom User hochgeladener Quellen (RAG). Jede Antwort enthält Zitate die auf den exakten Quellen-Abschnitt zurückführen. Das Projekt klont den Kern von Google NotebookLM und demonstriert eine vollständige RAG-Pipeline auf modernem TypeScript-Stack.

---

## 2. MVP-Scope

### 2.1 Auth & Notebooks (A1, A2)

- **NextAuth.js** mit Google und GitHub als OAuth-Provider
- Drizzle-Adapter für Session-Persistenz in Supabase
- Jedes Notebook gehört genau einem User (Row-Level-Isolation)
- Notebooks: Erstellen, Umbenennen, Löschen, Auflistung

### 2.2 Source-Ingestion (K2)

**Unterstützte Quell-Typen:**

| Typ | Bibliothek | Besonderheit |
|-----|-----------|--------------|
| PDF | `pdfjs-dist` | Text + Bilder + Positionen (bbox, Seite) extrahiert |
| Web-URL | `@mozilla/readability` + `node-fetch` | Jina AI Reader API als automatischer Fallback bei Bot-Detection |
| YouTube | `youtube-transcript` | Timestamps als Positions-Metadaten |
| Plain Text / Markdown | native | Direktverarbeitung |

**Ingestion-Pipeline (asynchron):**
1. Source anlegen, Status `pending`
2. Vercel Background Function startet: Extraktion → Parent-Child-Chunking → Voyage AI Embeddings → Supabase pgvector + S3
3. Client pollt `/api/sources/:id/status` bis `ready` oder `error`
4. Status-Anzeige: `pending` → `processing` → `ready` → `error`

**Chunking-Strategie:** Hierarchical Parent-Child
- Child-Chunks: ~256 Token (Retrieval-Granularität)
- Parent-Chunks: ~1024 Token (Kontext-Injection in Claude)
- Overlap: 50 Token zwischen Child-Chunks

**Bild-Extraktion (PDFs):**
- `pdfjs-dist` extrahiert eingebettete Bilder mit Seite + Bounding Box
- Bilder landen auf AWS S3, URL + Metadaten in DB
- Beim Zitat-Preview: Bilder die räumlich an den Chunk angrenzen werden mitgerendert

**Bekannte Limitationen:** Gescannte PDFs (Bild-PDFs) und JavaScript-gerenderte Webseiten (JS-SPA) werden nicht vollständig unterstützt.

### 2.3 RAG-Chat (K3, K4)

- **Vercel AI SDK** (`streamText` + `useChat`) für streaming Chat-UI
- Retrieval: Top-k Child-Chunks via pgvector Cosine Similarity → Parent-Chunks laden → in Claude-Kontext injizieren
- Antwort nur aus Notebook-Sources (kein allgemeines Weltwissen)
- **Zitat-UI:**
  - Kreisförmige shadcn-Badges inline im Antworttext
  - ≤ 3 Zitate: alle Badges sichtbar
  - \> 3 Zitate: Badge 1 + `···`-Badge (3 horizontale Punkte)
  - Klick auf `···`: Icon → `chevron-right chevron-left`, restliche Badges expandieren rechts
  - Klick auf `chevron-right chevron-left`: kollabiert wieder
  - Sidebar permanent sichtbar, Badge-Klick springt zum Chunk + zeigt angrenzendes Bild

### 2.4 Notizen (K5)

- Zwei Typen: **KI-Notizen** (aus Chat-Antwort gespeichert inkl. Zitate) und **Manuelle Notizen**
- Editor: einfaches Textarea-Feld
- Beide Typen nach dem Speichern vollständig editierbar
- Löschen möglich

### 2.5 Audio Overview (S1)

- Claude generiert Dialogskript: `[{speaker: "A"|"B", text: string}]`
- OpenAI TTS vertont: Host A → `alloy`, Host B → `nova`
- Audio-Segmente sequenziell generiert, auf AWS S3 gespeichert
- Client spielt Segments als Playlist ab
- **Nur kurze Audios im MVP** (~3 Min / ~800–1000 Wörter Skript)

### 2.6 Mind Map (S2)

- Claude generiert Graph: `{nodes: [{id, label}], edges: [{source, target, label?}]}`
- Gerendert mit **reactflow** (interaktiv, Zoom/Pan, Drag)
- Als PNG exportierbar

### 2.7 Slide Deck (S3)

- Claude generiert **Gamma-optimiertes Markdown** mit `---` Slide-Trennern
- UI: Copy-to-Clipboard Button + Anleitung ("Öffne gamma.app → Neues Deck → AI generieren → Einfügen")
- Kein eigenes Rendering im Browser für MVP

### 2.8 Data Tables (S4)

- Claude gibt strukturiertes JSON zurück: `{headers: string[], rows: string[][]}`
- Gerendert als interaktive Tabelle (sortierbar)
- CSV-Export Button

### 2.9 Source-Filter (K6)

- Rechts neben jeder Source im Sources-Panel: **Checkbox** (per default aktiviert)
- Deaktivierte Sources werden beim RAG-Retrieval **vollständig ausgeschlossen** — keine ihrer Child-Chunks werden im pgvector-Query berücksichtigt, auch wenn das Embedding zur Frage passen würde
- Filter-State wird in der DB persistiert (`sources.enabled: boolean`)
- Visuelles Feedback: deaktivierte Sources werden im Sources-Panel ausgegraut dargestellt
- Studio-Features (Audio, Mind Map, etc.) respektieren ebenfalls den Filter — nur aktivierte Sources fließen in die Generierung ein

### 2.10 Quiz (S5)

- Claude generiert **15 Multiple-Choice-Fragen**: `{question, options: [A,B,C,D], correct_index: 0-3, explanations: [A,B,C,D]}`
- Format: Wer-wird-Millionär-Stil (immer A / B / C / D)
- Sofort-Feedback nach Auswahl: korrekte Option grüner Rahmen + ✓, falsche gewählte Option roter Rahmen + ✗, alle zeigen Kontext-Erklärung
- Navigation: `← Zurück` + `Weiter →`
- Stift-Icon-Button löscht aktuelle Frage aus dem Quiz
- Design: Dark theme, shadcn Cards mit farbigen Borders

---

## 3. Technische Architektur

### 3.1 Stack

| Schicht | Technologie |
|---------|------------|
| Framework | Next.js 15 (App Router) |
| Sprache | TypeScript (strict) |
| Linting | ESLint (strict) + Prettier |
| ORM | Drizzle ORM |
| Datenbank | Supabase (PostgreSQL + pgvector) |
| Embeddings | Voyage AI `voyage-4` / `voyage-4-lite` |
| LLM | Anthropic Claude (via `@anthropic-ai/sdk`) |
| Chat-Streaming | Vercel AI SDK |
| TTS | OpenAI TTS (`tts-1`) |
| Dateispeicher | AWS S3 (`@aws-sdk/client-s3`) |
| Auth | NextAuth.js (Drizzle-Adapter) |
| UI | shadcn/ui + Tailwind CSS |
| Mind Map | reactflow |
| Deployment | Vercel (Background Functions) |

### 3.2 Ingestion-Flow

```
Upload → S3 (Rohdatei) → Background Function
  → pdfjs-dist / readability+Jina / youtube-transcript
  → Parent-Child Splitting
  → Voyage AI Embeddings (Child-Chunks)
  → Supabase: chunks + embeddings + image_refs
  → S3: Bilder
  → Status: ready
```

### 3.3 RAG-Chat-Flow

```
User-Frage
  → Voyage AI Embedding der Frage
  → pgvector: Top-k Child-Chunks (Cosine Similarity)
  → Parent-Chunks laden
  → Claude: System-Prompt + Sources + Frage
  → Vercel AI SDK streamText
  → Client: useChat Hook + Zitat-Badge-Rendering
```

---

## 4. Follow-up Features (Open Source / lokale GPU)

- **SSE Progress-Updates** beim Ingestion statt Polling
- **Audio-Längen-Optionen** (Mittel ~7 Min / Lang ~12 Min)
- **Vollständig lokale Pipeline:** Kokoro TTS + lokales LLM + lokale Embeddings auf GPU
- **Cytoscape.js** als Mind-Map-Alternative (Radial-Tree-Layout)
- **Pinchtab** für Web-Scraping (VPS/Docker-Deployment)
- **Infografiken (S6)** — KI-generierte visuelle Zusammenfassungen
- **Source Discovery** — KI schlägt verwandte Quellen vor

---

## 5. Engineering-Konventionen

- **Alle KI-Prompts auf Englisch:** System-Prompts und User-Prompts an Claude sowie Embedding-Instruktionen werden stets auf Englisch formuliert. App-UI und Fehlermeldungen können Deutsch bleiben.

## 6. Qualitätssicherung

- Vor jedem Commit: Tests, ESLint und TypeCheck müssen grün sein
- TDD (Red-Green-Refactor) für jeden Feature-Slice
- Jeder abgeschlossene Slice bekommt einen eigenen Git-Commit
- Keine echten Tokens oder Secrets im Code / Git-History
