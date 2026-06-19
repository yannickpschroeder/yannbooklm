# YannBookLM — Domain Context

YannBookLM ist ein quellen-gebundener KI-Forschungsassistent (NotebookLM-Klon), gebaut als Bewerbungsprojekt. Die KI antwortet ausschließlich auf Basis hochgeladener Quellen (RAG), jede Antwort enthält Zitate zurück zur Originalquelle.

## Ubiquitous Language

| Term | Definition |
|------|-----------|
| **Notebook** | Arbeitsbereich-Container eines Users. Enthält Quellen, Chat-Verlauf, Notizen und Studio-Outputs. |
| **Source** | Ein hochgeladenes Dokument oder eine verknüpfte URL (PDF, Webseite, YouTube-Video). Gehört zu genau einem Notebook. |
| **Chunk** | Textabschnitt einer Source nach dem Splitting. Existiert in zwei Granularitäten: Child-Chunk (klein, für Retrieval) und Parent-Chunk (groß, für Kontext-Injection). |
| **Embedding** | Vektor-Repräsentation eines Child-Chunks, gespeichert in pgvector für semantische Suche. |
| **Ingestion** | Der Prozess: Source hochladen → Text + Bilder extrahieren → Chunks erzeugen → Embeddings generieren → in DB speichern. Läuft asynchron via Vercel Background Function. |
| **Ingestion Status** | Zustand einer Source: `pending` → `processing` → `ready` → `error`. |
| **RAG-Chat** | Chat-Interface in dem der User Fragen stellt, die KI relevante Chunks retrievet und mit Claude beantwortet. Antworten sind ausschließlich durch Sources geerdet. |
| **Citation** | Verweis in einer Chat-Antwort auf den spezifischen Chunk (+ ggf. angrenzendes Bild) aus dem die Information stammt. Dargestellt als kreisförmiger shadcn-Badge. |
| **Note** | Vom User gespeicherter Text. Entweder manuell geschrieben oder aus einer KI-Antwort übernommen. Immer editierbar. |
| **Studio** | Bereich für KI-generierte Outputs aus den Sources: Audio Overview, Mind Map, Slide Deck, Data Table, Quiz. |
| **Audio Overview** | KI-generiertes Podcast-Gespräch zwischen zwei Hosts (Host A: `alloy`, Host B: `nova`) über die Notebook-Sources. Nur kurze Länge im MVP. |
| **Mind Map** | Interaktiver Konzept-Graph (reactflow) generiert aus den Sources. |
| **Slide Deck** | Gamma-optimierter Markdown-Prompt der aus den Sources generiert wird und in Gamma.app eingefügt werden kann. |
| **Data Table** | Strukturierte Tabelle extrahiert aus Sources via Anthropic structured output. |
| **Quiz** | 15 Multiple-Choice-Fragen (A/B/C/D) mit Sofort-Feedback und Kontext-Erklärungen, generiert aus Sources. |
| **Parent-Child Chunking** | RAG-Strategie: kleine Child-Chunks (256 Token) für präzises Embedding-Retrieval, große Parent-Chunks (1024 Token) für reichhaltigen LLM-Kontext. |
| **Source Filter** | Per-Source-Checkbox im Sources-Panel. Deaktivierte Sources werden beim RAG-Retrieval vollständig ausgeschlossen — keine ihrer Chunks werden geladen, unabhängig von der Embedding-Ähnlichkeit. |

## Engineering-Konventionen

- **Alle KI-Prompts (Claude, Voyage AI) werden auf Englisch formuliert.** Die App-Sprache und UI können Deutsch sein, aber System-Prompts, User-Prompts an Claude, und Embedding-Instruktionen sind stets Englisch — für konsistente Modell-Performance und einfacheres Debugging.

## Architektur-Übersicht

```
User → Next.js App (Vercel)
         ├── NextAuth.js (Google + GitHub OAuth)
         ├── RAG Pipeline
         │    ├── Ingestion: pdfjs-dist / readability+Jina / youtube-transcript
         │    ├── Chunking: Parent-Child (256/1024 Token)
         │    ├── Embeddings: Voyage AI voyage-4
         │    └── Storage: Supabase pgvector + AWS S3 (Bilder/PDFs/Audio)
         ├── Chat: Vercel AI SDK + Claude (Anthropic)
         └── Studio: Claude → Audio (OpenAI TTS) / reactflow / Gamma-Prompt / JSON-Table / Quiz
```
