import { db } from "@/db"
import { notebooks, sources, parentChunks } from "@/db/schema"
import { and, eq, asc } from "drizzle-orm"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; sourceId: string }> },
) {
  const { token, sourceId } = await params

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(eq(notebooks.shareToken, token))
    .limit(1)

  if (!notebook) return new Response("Not found", { status: 404 })

  const [source] = await db
    .select({
      id: sources.id,
      title: sources.title,
      type: sources.type,
      url: sources.url,
      summary: sources.summary,
      suggestedTopics: sources.suggestedTopics,
    })
    .from(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.notebookId, notebook.id), eq(sources.status, "ready"), eq(sources.enabled, true)))
    .limit(1)

  if (!source) return new Response("Not found", { status: 404 })

  const chunks = await db
    .select({ content: parentChunks.content, positionStart: parentChunks.positionStart, pageNumber: parentChunks.pageNumber })
    .from(parentChunks)
    .where(eq(parentChunks.sourceId, sourceId))
    .orderBy(asc(parentChunks.positionStart), asc(parentChunks.createdAt))

  const content = chunks.map((c) => c.content).join("\n\n")

  return Response.json({
    id: `${sourceId}-preview`,
    index: 0,
    sourceTitle: source.title,
    sourceType: source.type,
    sourceSummary: source.summary,
    sourceTopics: source.suggestedTopics,
    url: source.url,
    positionStart: chunks[0]?.positionStart ?? null,
    pageNumber: chunks[0]?.pageNumber ?? null,
    content,
  })
}
