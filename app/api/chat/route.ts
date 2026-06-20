import { auth } from "@/lib/auth"
import { streamText, convertToModelMessages, isTextUIPart } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { db } from "@/db"
import {
  messages as messagesTable,
  messageCitations,
  sources,
  childChunks,
  parentChunks,
  notebooks,
} from "@/db/schema"
import { and, eq, asc } from "drizzle-orm"
import { cosineDistance } from "drizzle-orm"
import { embedText } from "@/lib/ai/voyage"
import type { ChatMessage, CitationChunk } from "@/lib/types/chat"

export const maxDuration = 60

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = await req.json()
  const { notebookId, messages: uiMessages } = body as {
    notebookId: string
    messages: ChatMessage[]
  }

  if (!notebookId || !Array.isArray(uiMessages)) {
    return new Response("Bad Request", { status: 400 })
  }

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) {
    return new Response("Not found", { status: 404 })
  }

  const lastUserMsg = [...uiMessages].reverse().find((m) => m.role === "user")
  if (!lastUserMsg) {
    return new Response("No user message", { status: 400 })
  }

  const userText = lastUserMsg.parts.filter(isTextUIPart).map((p) => p.text).join(" ").trim()
  if (!userText) {
    return new Response("Empty message", { status: 400 })
  }

  const embedding = await embedText(userText)

  const topChunks = await db
    .select({
      id: childChunks.id,
      positionStart: childChunks.positionStart,
      pageNumber: childChunks.pageNumber,
      parentContent: parentChunks.content,
      sourceTitle: sources.title,
      sourceType: sources.type,
      sourceSummary: sources.summary,
      sourceTopics: sources.suggestedTopics,
      sourceUrl: sources.url,
    })
    .from(childChunks)
    .innerJoin(parentChunks, eq(parentChunks.id, childChunks.parentChunkId))
    .innerJoin(sources, eq(sources.id, childChunks.sourceId))
    .where(
      and(
        eq(sources.notebookId, notebookId),
        eq(sources.status, "ready"),
        eq(sources.enabled, true),
      ),
    )
    .orderBy(asc(cosineDistance(childChunks.embedding, embedding)))
    .limit(5)

  const citationChunks: CitationChunk[] = topChunks.map((c, i) => ({
    index: i + 1,
    id: c.id,
    sourceTitle: c.sourceTitle,
    sourceType: c.sourceType,
    sourceSummary: c.sourceSummary,
    sourceTopics: c.sourceTopics as string[] | null,
    url: c.sourceUrl,
    positionStart: c.positionStart,
    pageNumber: c.pageNumber,
    content: c.parentContent,
  }))

  const modelMessages = await convertToModelMessages(uiMessages)
  const systemPrompt = buildSystemPrompt(citationChunks)

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages: modelMessages,
    onFinish: async ({ text }) => {
      try {
        await db
          .insert(messagesTable)
          .values({ notebookId, role: "user", content: userText })

        const [assistantRow] = await db
          .insert(messagesTable)
          .values({ notebookId, role: "assistant", content: text })
          .returning({ id: messagesTable.id })

        const citedIndices = [
          ...new Set(
            [...text.matchAll(/\[(\d+)\]/g)].map((m) => parseInt(m[1]) - 1),
          ),
        ]

        for (const [order, idx] of citedIndices.entries()) {
          const chunk = citationChunks[idx]
          if (!chunk) continue
          await db.insert(messageCitations).values({
            messageId: assistantRow.id,
            childChunkId: chunk.id,
            orderIndex: order,
          })
        }
      } catch (err) {
        console.error("[chat] Failed to save messages:", err)
      }
    },
  })

  return result.toUIMessageStreamResponse<ChatMessage>({
    messageMetadata: () => ({ citations: citationChunks }),
  })
}

function buildSystemPrompt(chunks: CitationChunk[]): string {
  if (chunks.length === 0) {
    return `You are a helpful assistant. No sources are indexed yet. Tell the user in German that no sources are available.`
  }

  const sourceList = chunks
    .map((c) => `[${c.index}] ${c.sourceTitle}\n---\n${c.content}\n---`)
    .join("\n\n")

  return `You are a helpful assistant that answers questions exclusively based on the provided sources.

Rules:
- Answer ONLY based on the sources below. Do not use external knowledge.
- If the information is not in the sources, say so explicitly.
- Cite sources inline using [N] notation (e.g. [1], [2]) directly after the relevant sentence.
- Always respond in German.
- Be concise and accurate.

Sources:
${sourceList}`
}
