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
      notebookId: sources.notebookId,
    })
    .from(sources)
    .innerJoin(notebooks, eq(notebooks.id, sources.notebookId))
    .where(and(eq(sources.id, sourceId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!source) return new Response("Not found", { status: 404 })

  // Get the first parent chunk (representative content)
  const [chunk] = await db
    .select({
      content: parentChunks.content,
      positionStart: parentChunks.positionStart,
      pageNumber: parentChunks.pageNumber,
    })
    .from(parentChunks)
    .where(eq(parentChunks.sourceId, sourceId))
    .orderBy(asc(parentChunks.positionStart), asc(parentChunks.createdAt))
    .limit(1)

  return Response.json({
    id: `${sourceId}-preview`,
    index: 0,
    sourceTitle: source.title,
    sourceType: source.type,
    url: source.url,
    positionStart: chunk?.positionStart ?? null,
    pageNumber: chunk?.pageNumber ?? null,
    content: chunk?.content ?? "",
  })
}
