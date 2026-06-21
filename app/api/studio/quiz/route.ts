import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { db } from "@/db"
import { studioOutputs, notebooks, parentChunks, sources } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export const maxDuration = 60

const QuizSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()).length(4),
      correct: z.number().int().min(0).max(3),
      explanation: z.string(),
    })
  ).length(15),
  topics: z.array(z.string()).min(1).max(8),
  suggestions: z.array(z.string()).min(1).max(4),
})

async function getSourceContent(notebookId: string): Promise<string> {
  const chunks = await db
    .select({ content: parentChunks.content, title: sources.title })
    .from(parentChunks)
    .innerJoin(sources, eq(sources.id, parentChunks.sourceId))
    .where(and(eq(sources.notebookId, notebookId), eq(sources.status, "ready"), eq(sources.enabled, true)))
    .limit(60)

  if (chunks.length === 0) return ""

  return chunks
    .map((c) => `[${c.title}]\n${c.content}`)
    .join("\n\n---\n\n")
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { notebookId, focusTopic, outputId } = (await req.json()) as {
    notebookId: string
    focusTopic?: string
    outputId?: string
  }

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) return NextResponse.json({ error: "Notebook not found" }, { status: 404 })

  const content = await getSourceContent(notebookId)
  if (!content) return NextResponse.json({ error: "NO_SOURCES" }, { status: 422 })

  const focusInstruction = focusTopic
    ? `Fokussiere dich besonders auf das Thema: "${focusTopic}".`
    : ""

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: QuizSchema,
    prompt: `Du bist ein Quiz-Generator. Erstelle auf Basis der folgenden Quellen ein Multiple-Choice-Quiz mit genau 15 Fragen auf Deutsch.
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

  if (outputId) {
    const [updated] = await db
      .update(studioOutputs)
      .set({ data: object, createdAt: new Date() })
      .where(and(eq(studioOutputs.id, outputId), eq(studioOutputs.notebookId, notebookId)))
      .returning()
    return NextResponse.json(updated)
  }

  const [created] = await db
    .insert(studioOutputs)
    .values({ notebookId, type: "quiz", data: object })
    .returning()

  return NextResponse.json(created, { status: 201 })
}
