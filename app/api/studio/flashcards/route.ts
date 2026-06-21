import { auth } from "@/lib/auth"
import { NextResponse, after } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { db } from "@/db"
import { studioOutputs, notebooks, parentChunks, sources } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export const maxDuration = 60

type Difficulty = "einfach" | "mittel" | "schwierig"

const difficultyContext: Record<Difficulty, string> = {
  einfach: "Das Kartendeck richtet sich an Einsteiger oder Menschen, die sich gerade erst mit dem Thema vertraut machen. Formuliere die Vorderseiten klar und direkt. Die Antworten auf der Rückseite sollen einfach und verständlich sein.",
  mittel: "Das Kartendeck richtet sich an Lernende mit Grundkenntnissen, die ihr Wissen vertiefen möchten. Mische einfache Begriffserklärungen mit Fragen, die echtes Verständnis erfordern.",
  schwierig: "Das Kartendeck richtet sich an fortgeschrittene Lernende. Stelle anspruchsvolle Fragen zu Details, Zusammenhängen und feinen Unterschieden, die tiefes Verständnis voraussetzen.",
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

async function runFlashcardGeneration(
  outputId: string,
  notebookId: string,
  count: number,
  difficulty: Difficulty,
  focusTopic?: string
) {
  try {
    const { content, usedSources } = await getSourceContent(notebookId)
    if (!content) {
      await db.update(studioOutputs).set({ status: "error" }).where(eq(studioOutputs.id, outputId))
      return
    }

    const FlashcardSchema = z.object({
      cards: z.array(
        z.object({
          front: z.string(),
          back: z.string(),
        })
      ).length(count),
      topics: z.array(z.string()).min(1).max(8),
      suggestions: z.array(z.string()).min(1).max(4),
    })

    const focusInstruction = focusTopic ? `Fokussiere dich besonders auf das Thema: "${focusTopic}".` : ""

    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: FlashcardSchema,
      prompt: `Du bist ein Lernkarten-Generator. Erstelle auf Basis der folgenden Quellen ein Kartendeck mit genau ${count} Lernkarten auf Deutsch.
Schwierigkeitsgrad: ${difficulty} – ${difficultyContext[difficulty]}
${focusInstruction}

Anforderungen:
- Jede Karte hat eine "front" (prägnante Frage oder Begriff) und eine "back" (vollständige Antwort oder Erklärung)
- Die Vorderseite soll neugierig machen und zum Nachdenken anregen
- Die Rückseite soll klar und vollständig antworten
- "topics": 3-8 Hauptthemen die im Kartendeck behandelt werden
- "suggestions": 4 Themenvorschläge für ein weiteres Kartendeck (Themen aus den Quellen, die noch nicht abgedeckt wurden)

Quellen:
${content}`,
    })

    const data = { ...object, usedSources }

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

  const { notebookId, focusTopic, outputId, count = 20, difficulty = "mittel" } = (await req.json()) as {
    notebookId: string
    focusTopic?: string
    outputId?: string
    count?: number
    difficulty?: Difficulty
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
      .values({ notebookId, type: "flashcards", status: "generating" })
      .returning()
    jobOutputId = created.id
  }

  after(() => runFlashcardGeneration(jobOutputId, notebookId, count, difficulty as Difficulty, focusTopic))

  return NextResponse.json({ outputId: jobOutputId }, { status: 202 })
}
