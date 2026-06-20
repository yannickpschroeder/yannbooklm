import { auth } from "@/lib/auth"
import { db } from "@/db"
import { sources, parentChunks, notebooks } from "@/db/schema"
import { and, eq, asc } from "drizzle-orm"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const { sourceId } = await params

  // Verify the source belongs to the authenticated user via notebook
  const [source] = await db
    .select({
      id: sources.id,
      title: sources.title,
      type: sources.type,
      url: sources.url,
      summary: sources.summary,
      suggestedTopics: sources.suggestedTopics,
      notebookId: sources.notebookId,
    })
    .from(sources)
    .innerJoin(notebooks, eq(notebooks.id, sources.notebookId))
    .where(and(eq(sources.id, sourceId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!source) return new Response("Not found", { status: 404 })

  // Load all parent chunks ordered by position
  const chunks = await db
    .select({
      content: parentChunks.content,
      positionStart: parentChunks.positionStart,
      pageNumber: parentChunks.pageNumber,
    })
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
