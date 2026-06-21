import { auth } from "@/lib/auth"
import { NextResponse, after } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { db } from "@/db"
import { studioOutputs, notebooks, parentChunks, sources } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export const maxDuration = 60

const DatatableSchema = z.object({
  title: z.string(),
  headers: z.array(z.string()).min(1).max(20),
  rows: z.array(z.array(z.string())).min(1).max(200),
})

export type DatatableData = z.infer<typeof DatatableSchema> & {
  usedSources: { id: string; title: string; type: string }[]
  language?: string
}

const LANG_NAMES: Record<string, string> = {
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

  return { content: rows.map((c) => `[${c.title}]\n${c.content}`).join("\n\n---\n\n"), usedSources }
}

async function runDatatableGeneration(outputId: string, notebookId: string, focusTopic?: string, language?: string) {
  try {
    const { content, usedSources } = await getSourceContent(notebookId)
    if (!content) {
      await db.update(studioOutputs).set({ status: "error" }).where(eq(studioOutputs.id, outputId))
      return
    }

    const focusInstruction = focusTopic ? `\nFokus: "${focusTopic}"` : ""
    const languageInstruction = language
      ? `\n- Erstelle die Tabelle auf ${LANG_NAMES[language] ?? language}.`
      : "\n- Verwende die Sprache der Quellen."

    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: DatatableSchema,
      prompt: `Du bist ein Datenextraktor. Extrahiere strukturierte, tabellarische Daten aus den folgenden Quellen.${focusInstruction}

Regeln:
- title: kurzer, prägnanter Titel der Tabelle (max. 8 Wörter)
- headers: Spaltenüberschriften (1–20 Spalten, kurz und klar)
- rows: Datenzeilen als String-Arrays. Jede Zeile muss genau so viele Einträge haben wie headers.
- Extrahiere alle relevanten Entitäten, Kennzahlen, Vergleiche oder Listen die tabellarisch darstellbar sind.
- Bevorzuge konkrete Zahlen, Namen und Fakten gegenüber abstrakten Beschreibungen.${languageInstruction}
- Maximal 200 Zeilen, mindestens 1 Zeile.

Quellen:
${content}`,
    })

    const rows = object.rows.map((row) => {
      if (row.length === object.headers.length) return row
      const padded = [...row]
      while (padded.length < object.headers.length) padded.push("")
      return padded.slice(0, object.headers.length)
    })

    const data: DatatableData = { ...object, rows, usedSources, language }

    await db
      .update(studioOutputs)
      .set({ status: "ready", title: object.title, data, createdAt: new Date() })
      .where(eq(studioOutputs.id, outputId))
  } catch {
    await db.update(studioOutputs).set({ status: "error" }).where(eq(studioOutputs.id, outputId))
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { notebookId, outputId, focusTopic, language } = (await req.json()) as {
    notebookId: string
    outputId?: string
    focusTopic?: string
    language?: string
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
      .values({ notebookId, type: "datatable", status: "generating" })
      .returning()
    jobOutputId = created.id
  }

  after(() => runDatatableGeneration(jobOutputId, notebookId, focusTopic, language))

  return NextResponse.json({ outputId: jobOutputId }, { status: 202 })
}
