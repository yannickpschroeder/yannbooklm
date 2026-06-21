import { auth } from "@/lib/auth"
import { NextResponse, after } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import { z } from "zod"
import { db } from "@/db"
import { studioOutputs, notebooks, parentChunks, sources } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export const maxDuration = 10

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

const MindmapSchema = z.object({
  title: z.string(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
      group: z.string().optional(),
    })
  ).min(3).max(40),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      label: z.string().optional(),
    })
  ).min(2).max(60),
})

export type MindmapData = z.infer<typeof MindmapSchema> & { usedSources: { id: string; title: string; type: string }[] }

async function runMindmapGeneration(outputId: string, notebookId: string, focusTopic?: string) {
  try {
    const { content, usedSources } = await getSourceContent(notebookId)
    if (!content) {
      await db.update(studioOutputs).set({ status: "error" }).where(eq(studioOutputs.id, outputId))
      return
    }

    const focusInstruction = focusTopic ? `\nFokus: "${focusTopic}"` : ""

    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: MindmapSchema,
      prompt: `Du bist ein Wissenskarten-Generator. Extrahiere die wichtigsten Konzepte und ihre Beziehungen aus den folgenden Quellen und stelle sie als Graph dar.${focusInstruction}

Regeln:
- title: kurzer Gesamttitel der Mindmap (max. 8 Wörter)
- nodes: 8–25 Konzepte. Jeder Knoten hat eine eindeutige id (slug), ein label (max. 4 Wörter), optional description (1–2 Sätze zur Erläuterung) und optional group (Oberkategorie).
- edges: Beziehungen zwischen Konzepten. Label beschreibt die Beziehung knapp (max. 4 Wörter).
- Vermeide isolierte Knoten – jeder Knoten muss mindestens eine Kante haben.
- Verwende die Sprache der Quellen.

Quellen:
${content}`,
    })

    const data: MindmapData = { ...object, usedSources }

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

  const { notebookId, outputId, focusTopic } = (await req.json()) as {
    notebookId: string
    outputId?: string
    focusTopic?: string
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
      .values({ notebookId, type: "mindmap", status: "generating" })
      .returning()
    jobOutputId = created.id
  }

  after(() => runMindmapGeneration(jobOutputId, notebookId, focusTopic))

  return NextResponse.json({ outputId: jobOutputId }, { status: 202 })
}
