import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { db } from "@/db"
import { notebooks, parentChunks, sources } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export const maxDuration = 30

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const notebookId = searchParams.get("notebookId")
  if (!notebookId) return NextResponse.json({ error: "notebookId required" }, { status: 400 })

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const rows = await db
    .select({ content: parentChunks.content, title: sources.title })
    .from(parentChunks)
    .innerJoin(sources, eq(sources.id, parentChunks.sourceId))
    .where(and(eq(sources.notebookId, notebookId), eq(sources.status, "ready"), eq(sources.enabled, true)))
    .limit(20)

  if (rows.length === 0) return NextResponse.json({ suggestions: [] })

  const preview = rows
    .slice(0, 8)
    .map((r) => `[${r.title}]\n${r.content.slice(0, 300)}`)
    .join("\n\n---\n\n")

  const SuggestionsSchema = z.object({
    suggestions: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
      })
    ).length(4),
  })

  try {
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: SuggestionsSchema,
      prompt: `Analysiere die folgenden Quellen-Auszüge und schlage 4 spezifische, nützliche Berichtsformate vor, die gut zu diesem Inhalt passen würden. Die Formate sollen praxisorientiert, konkret und für den jeweiligen Kontext sinnvoll sein.

Anforderungen:
- "title": kurzer, prägnanter Formatname (max. 4 Wörter)
- "description": ein Satz der beschreibt, was dieser Bericht enthält (max. 15 Wörter)
- Die 4 Vorschläge sollen sich inhaltlich voneinander unterscheiden

Quellen-Auszüge:
${preview}`,
    })

    return NextResponse.json(object)
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}
