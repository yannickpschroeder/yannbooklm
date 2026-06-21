import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/db"
import { sources, messages, messageCitations, childChunks, parentChunks } from "@/db/schema"
import { and, eq, asc } from "drizzle-orm"
import { ChatPanel } from "@/components/notebook/chat-panel"
import type { ChatMessage, CitationChunk } from "@/lib/types/chat"

export default async function NotebookPage({
  params,
}: {
  params: Promise<{ notebookId: string }>
}) {
  const { notebookId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [readySources, messageRows] = await Promise.all([
    db
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.notebookId, notebookId), eq(sources.status, "ready"), eq(sources.enabled, true))),

    db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        citationId: messageCitations.childChunkId,
        citationOrder: messageCitations.orderIndex,
        positionStart: childChunks.positionStart,
        pageNumber: childChunks.pageNumber,
        parentContent: parentChunks.content,
        sourceTitle: sources.title,
        sourceType: sources.type,
        sourceUrl: sources.url,
      })
      .from(messages)
      .leftJoin(messageCitations, eq(messageCitations.messageId, messages.id))
      .leftJoin(childChunks, eq(childChunks.id, messageCitations.childChunkId))
      .leftJoin(parentChunks, eq(parentChunks.id, childChunks.parentChunkId))
      .leftJoin(sources, eq(sources.id, childChunks.sourceId))
      .where(eq(messages.notebookId, notebookId))
      .orderBy(asc(messages.createdAt), asc(messageCitations.orderIndex)),
  ])

  // Group rows by message id
  type CitRow = {
    id: string
    citationId: string | null
    citationOrder: number | null
    positionStart: number | null
    pageNumber: number | null
    parentContent: string | null
    sourceTitle: string | null
    sourceType: string | null
    sourceUrl: string | null
  }
  const seen = new Map<string, { role: string; content: string; citations: CitationChunk[] }>()
  for (const row of messageRows as (typeof messageRows[number] & CitRow)[]) {
    if (!seen.has(row.id)) {
      seen.set(row.id, { role: row.role, content: row.content, citations: [] })
    }
    if (row.citationId && row.sourceTitle) {
      const group = seen.get(row.id)!
      const alreadyAdded = group.citations.some((c) => c.id === row.citationId)
      if (!alreadyAdded) {
        group.citations.push({
          index: row.citationOrder ?? group.citations.length + 1,
          id: row.citationId,
          sourceTitle: row.sourceTitle,
          sourceType: row.sourceType ?? "url",
          url: row.sourceUrl ?? null,
          positionStart: row.positionStart ?? null,
          pageNumber: row.pageNumber ?? null,
          content: row.parentContent ?? "",
        })
      }
    }
  }

  const initialMessages: ChatMessage[] = [...seen.entries()].map(
    ([id, { role, content, citations }]) => ({
      id,
      role: role as "user" | "assistant",
      parts: [{ type: "text" as const, text: content, state: "done" as const }],
      metadata: citations.length > 0 ? { citations } : undefined,
    }),
  )

  return (
    <ChatPanel
      notebookId={notebookId}
      readySourceCount={readySources.length}
      initialMessages={initialMessages}
    />
  )
}
