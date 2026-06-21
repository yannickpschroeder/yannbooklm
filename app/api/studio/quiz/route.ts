import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { db } from "@/db"
import { studioOutputs, notebooks, parentChunks, sources } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export const maxDuration = 60

type Difficulty = "einfach" | "mittel" | "schwierig"

const difficultyInstruction: Record<Difficulty, string> = {
  einfach: "Verwende klare, einfache Sprache und direkte Fakten. Die Antwortoptionen sollen eindeutig unterscheidbar sein.",
  mittel: "Ausgewogene Mischung aus einfachen und komplexen Fragen.",
  schwierig: "Detailreiche, anspruchsvolle Fragen mit subtilen Unterschieden zwischen den Antwortoptionen.",
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

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { notebookId, focusTopic, outputId, count = 15, difficulty = "mittel" } = (await req.json()) as {
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

  const { content, usedSources } = await getSourceContent(notebookId)
  if (!content) return NextResponse.json({ error: "NO_SOURCES" }, { status: 422 })

  const QuizSchema = z.object({
    questions: z.array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).length(4),
        correct: z.number().int().min(0).max(3),
        explanation: z.string(),
      })
    ).length(count),
    topics: z.array(z.string()).min(1).max(8),
    suggestions: z.array(z.string()).min(1).max(4),
  })

  const focusInstruction = focusTopic ? `Fokussiere dich besonders auf das Thema: "${focusTopic}".` : ""

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: QuizSchema,
    prompt: `Du bist ein Quiz-Generator. Erstelle auf Basis der folgenden Quellen ein Multiple-Choice-Quiz mit genau ${count} Fragen auf Deutsch.
Schwierigkeitsgrad: ${difficultyInstruction[difficulty] ?? difficultyInstruction.mittel}
${focusInstruction}

Anforderungen:
- Jede Frage hat genau 4 Antwortmöglichkeiten (A, B, C, D)
- Genau eine Antwort ist korrekt (Index 0-3)
- Jede Frage hat eine kurze Erklärung warum die Antwort korrekt ist
- "topics": 3-8 Hauptthemen die im Quiz behandelt werden
- "suggestions": 4 Themenvorschläge für ein weiteres Quiz (Themen die in den Quellen vorkommen aber nicht ausführlich behandelt wurden)

Quellen:
${content}`,
  })

  const data = { ...object, usedSources }

  if (outputId) {
    const [updated] = await db
      .update(studioOutputs)
      .set({ data, createdAt: new Date() })
      .where(and(eq(studioOutputs.id, outputId), eq(studioOutputs.notebookId, notebookId)))
      .returning()
    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(studioOutputs)
    .values({ notebookId, type: "quiz", data })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
