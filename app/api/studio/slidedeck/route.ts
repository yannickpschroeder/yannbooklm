import { auth } from "@/lib/auth"
import { NextResponse, after } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { db } from "@/db"
import { studioOutputs, notebooks, parentChunks, sources } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export const maxDuration = 10

type SlideFormat = "detailed" | "presenter"
type SlideLength = "short" | "standard"

const LANGUAGE_NAMES: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
  fr: "Französisch",
  es: "Spanisch",
  it: "Italienisch",
  pt: "Portugiesisch",
  nl: "Niederländisch",
  pl: "Polnisch",
}

async function getSourceContent(notebookId: string) {
  const rows = await db
    .select({ content: parentChunks.content, id: sources.id, title: sources.title, type: sources.type })
    .from(parentChunks)
    .innerJoin(sources, eq(sources.id, parentChunks.sourceId))
    .where(and(eq(sources.notebookId, notebookId), eq(sources.status, "ready"), eq(sources.enabled, true)))
    .limit(60)

  if (rows.length === 0) return { content: "", usedSources: [] }

  const seen = new Set<string>()
  const usedSources: { id: string; title: string; type: string }[] = []
  for (const r of rows) {
    if (!seen.has(r.id)) {
      seen.add(r.id)
      usedSources.push({ id: r.id, title: r.title, type: r.type })
    }
  }

  const content = rows.map((c) => `[${c.title}]\n${c.content}`).join("\n\n---\n\n")
  return { content, usedSources }
}

async function runSlidedeckGeneration(
  outputId: string,
  notebookId: string,
  format: SlideFormat,
  length: SlideLength,
  language: string,
  focusTopic?: string,
  revisionInstructions?: Record<string, string>,
  existingSlides?: Array<{ title: string; bullets: string[] }>,
) {
  try {
    const { content, usedSources } = await getSourceContent(notebookId)
    if (!content) {
      await db.update(studioOutputs).set({ status: "error" }).where(eq(studioOutputs.id, outputId))
      return
    }

    const slideCount = length === "short" ? 8 : 15
    const languageName = LANGUAGE_NAMES[language] ?? language

    const formatInstruction =
      format === "detailed"
        ? "Detaillierte Präsentation: Vollständiger Text auf den Folien, geeignet als eigenständiges Lesedokument. Bullets dürfen längere Sätze enthalten."
        : "Folien für Vortragende: Knappe Stichpunkte (max. 6 Wörter pro Bullet), die einen Live-Vortrag unterstützen. Kein vollständiger Satz."

    const focusInstruction = focusTopic ? `\nFokus: "${focusTopic}"` : ""

    const SlidedeckSchema = z.object({
      presentationTitle: z.string(),
      slides: z
        .array(
          z.object({
            title: z.string(),
            bullets: z.array(z.string()).min(0).max(8),
            speakerNotes: z.string(),
          })
        )
        .min(slideCount)
        .max(slideCount),
    })

    let prompt: string
    if (revisionInstructions && existingSlides && Object.keys(revisionInstructions).length > 0) {
      const existingText = existingSlides
        .map((s, i) => `Folie ${i + 1} — ${s.title}\n${s.bullets.map((b) => `  • ${b}`).join("\n")}`)
        .join("\n\n")
      const instrText = Object.entries(revisionInstructions)
        .map(([idx, instr]) => `Folie ${Number(idx) + 1}: ${instr}`)
        .join("\n")
      prompt = `Du bist ein Präsentations-Überarbeiter. Dir liegt eine bestehende Präsentation vor, die du gemäß der Überarbeitungsanweisungen verbesserst. Nicht erwähnte Folien übernimmst du unverändert, solange sie noch passen.

Bestehende Präsentation (${existingSlides.length} Folien):
${existingText}

Überarbeitungsanweisungen:
${instrText}

Format: ${formatInstruction}

Erstelle die überarbeitete Präsentation auf ${languageName} mit exakt ${slideCount} Folien. Für jede Folie eine kurze speakerNotes.

Quellen (zur Ergänzung fehlender Fakten):
${content}`
    } else {
      prompt = `Du bist ein Präsentations-Generator. Erstelle auf Basis der folgenden Quellen eine Präsentation auf ${languageName} mit genau ${slideCount} Folien.

Format: ${formatInstruction}${focusInstruction}

Struktur:
- Folie 1: Titelfolie (title = Präsentationstitel, bullets = 1-2 kurze Untertitel-Zeilen)
- Folien 2 bis ${slideCount - 1}: Inhaltsfolien (title = Folientitel, bullets = 3-6 Punkte)
- Folie ${slideCount}: Abschlussfolie (title = z.B. "Fazit" oder "Zusammenfassung", bullets = 3-4 Kernaussagen)

Für jede Folie eine kurze speakerNotes (1-2 Sätze als Sprechhinweis für den Vortragenden).

Quellen:
${content}`
    }

    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: SlidedeckSchema,
      prompt,
    })

    const data = { ...object, format, length, language, usedSources }

    await db
      .update(studioOutputs)
      .set({ status: "ready", title: object.presentationTitle, data, createdAt: new Date() })
      .where(eq(studioOutputs.id, outputId))
  } catch {
    await db.update(studioOutputs).set({ status: "error" }).where(eq(studioOutputs.id, outputId))
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const {
    notebookId,
    outputId,
    format = "detailed",
    length = "standard",
    language = "de",
    focusTopic,
    revisionInstructions,
    existingSlides,
  } = (await req.json()) as {
    notebookId: string
    outputId?: string
    format?: SlideFormat
    length?: SlideLength
    language?: string
    focusTopic?: string
    revisionInstructions?: Record<string, string>
    existingSlides?: Array<{ title: string; bullets: string[] }>
  }

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) return NextResponse.json({ error: "Notebook not found" }, { status: 404 })

  const [hasSource] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.notebookId, notebookId), eq(sources.status, "ready"), eq(sources.enabled, true)))
    .limit(1)

  if (!hasSource) return NextResponse.json({ error: "NO_SOURCES" }, { status: 422 })

  let jobOutputId: string

  if (outputId) {
    await db
      .update(studioOutputs)
      .set({ status: "generating", data: null, createdAt: new Date() })
      .where(and(eq(studioOutputs.id, outputId), eq(studioOutputs.notebookId, notebookId)))
    jobOutputId = outputId
  } else {
    const [created] = await db
      .insert(studioOutputs)
      .values({ notebookId, type: "slidedeck", status: "generating" })
      .returning()
    jobOutputId = created.id
  }

  after(() => runSlidedeckGeneration(jobOutputId, notebookId, format, length, language, focusTopic, revisionInstructions, existingSlides))

  return NextResponse.json({ outputId: jobOutputId }, { status: 202 })
}
