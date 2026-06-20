import type { UIMessage } from "ai"

export type CitationChunk = {
  index: number
  id: string
  sourceTitle: string
  sourceType: string
  sourceSummary?: string | null
  sourceTopics?: string[] | null
  url: string | null
  positionStart: number | null
  pageNumber: number | null
  content: string
}

export type ChatMeta = {
  citations?: CitationChunk[]
}

export type ChatMessage = UIMessage<ChatMeta>
