import { auth } from "@/lib/auth"
import { NextResponse, after } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { db } from "@/db"
import { studioOutputs, notebooks, parentChunks, sources } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export const maxDuration = 10

const FIXED_FORMATS: Record<string, string> = {
  overview:
    "Erstelle einen strukturierten Überblick über die wichtigsten Informationen und Erkenntnisse aus den Quellen mit relevanten Zitaten.",
  studyplan:
    "Erstelle einen Lernplan mit kurzen Fragen und Antworten, vorgeschlagenen Essay-Fragestellungen und einem Glossar der wichtigsten Begriffe.",
  blogpost:
    "Schreibe einen aufschlussreichen Blogpost, der die wichtigsten Kernpunkte aus den Quellen für ein breites Publikum verständlich zusammenfasst.",
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

async function runReportGeneration(
  outputId: string,
  notebookId: string,
  format: string,
  language: string,
  customPrompt?: string
) {
  try {
    const { content, usedSources } = await getSourceContent(notebookId)
    if (!content) {
      await db.update(studioOutputs).set({ status: "error" }).where(eq(studioOutputs.id, outputId))
      return
    }

    const formatInstruction =
      FIXED_FORMATS[format] ??
      (customPrompt
        ? `Erstelle einen Bericht nach folgender Beschreibung: ${customPrompt}`
        : "Erstelle einen umfassenden Bericht über die wichtigsten Inhalte der Quellen.")

    const userInstructions = customPrompt && !FIXED_FORMATS[format]
      ? ""
      : customPrompt
        ? `\nZusätzliche Anweisungen: ${customPrompt}`
        : ""

    const ReportSchema = z.object({
      title: z.string(),
      sections: z.array(
        z.object({
          heading: z.string(),
          content: z.string(),
        })
      ).min(2).max(10),
    })

    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: ReportSchema,
      prompt: `Du bist ein professioneller Bericht-Generator. ${formatInstruction}${userInstructions}
Antworte auf ${language === "de" ? "Deutsch" : language === "en" ? "Englisch" : language}.

Anforderungen:
- "title": prägnanter, aussagekräftiger Titel des Berichts
- "sections": 3–8 Abschnitte, jeder mit "heading" (Abschnittstitel) und "content" (Inhalt als Markdown)
- Der Content jedes Abschnitts soll fließend und informativ sein (kein oberflächliches Aufzählen)
- Nutze Markdown für Formatierung: **fett** für wichtige Begriffe, Aufzählungen wo sinnvoll

Quellen:
${content}`,
    })

    const data = { ...object, format, usedSources }

    await db
      .update(studioOutputs)
      .set({ status: "ready", data, createdAt: new Date() })
      .where(eq(studioOutputs.id, outputId))
  } catch {
    await db.update(studioOutputs).set({ status: "error" }).where(eq(studioOutputs.id, outputId))
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { notebookId, format = "custom", language = "de", customPrompt, outputId } = (await req.json()) as {
    notebookId: string
    format?: string
    language?: string
    customPrompt?: string
    outputId?: string
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
      .values({ notebookId, type: "report", status: "generating" })
      .returning()
    jobOutputId = created.id
  }

  after(() => runReportGeneration(jobOutputId, notebookId, format, language, customPrompt))

  return NextResponse.json({ outputId: jobOutputId }, { status: 202 })
}
