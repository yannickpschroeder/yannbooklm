import type { PdfPage } from "./pdf"

export interface ParentChunk {
  content: string
  pageNumber: number
  positionStart: number
  positionEnd: number
}

export interface ChildChunk {
  content: string
  pageNumber: number
  positionStart: number
  parentIndex: number
}

// Approximation: 1 token ≈ 4 characters
const CHARS_PER_TOKEN = 4
const PARENT_MAX_TOKENS = 1024
const CHILD_MAX_TOKENS = 256
const CHILD_OVERLAP_TOKENS = 32

const PARENT_MAX_CHARS = PARENT_MAX_TOKENS * CHARS_PER_TOKEN
const CHILD_MAX_CHARS = CHILD_MAX_TOKENS * CHARS_PER_TOKEN
const CHILD_OVERLAP_CHARS = CHILD_OVERLAP_TOKENS * CHARS_PER_TOKEN

const IMAGE_MARKDOWN_RE = /!\[.*?\]\(s3:\/\/[^)]+\)/g

// Strip image markdown for text-only child chunks (used for RAG embeddings)
function stripImages(content: string): string {
  return content.replace(IMAGE_MARKDOWN_RE, "").replace(/\n{3,}/g, "\n\n").trim()
}

export function buildParentChunks(pages: PdfPage[]): ParentChunk[] {
  const chunks: ParentChunk[] = []
  let buffer = ""
  let bufferPage = 1
  let chunkStart = 0

  for (const page of pages) {
    // Treat image markdown as atomic units alongside text sentences
    const segments = splitIntoSegments(page.content)

    for (const segment of segments) {
      if (buffer.length + segment.length > PARENT_MAX_CHARS && buffer.length > 0) {
        chunks.push({
          content: buffer.trim(),
          pageNumber: bufferPage,
          positionStart: chunkStart,
          positionEnd: chunkStart + buffer.length,
        })
        chunkStart += buffer.length
        buffer = ""
        bufferPage = page.pageNumber
      }

      if (buffer.length === 0) bufferPage = page.pageNumber
      buffer += (buffer ? "\n\n" : "") + segment
    }
  }

  if (buffer.trim().length > 0) {
    chunks.push({
      content: buffer.trim(),
      pageNumber: bufferPage,
      positionStart: chunkStart,
      positionEnd: chunkStart + buffer.length,
    })
  }

  return chunks
}

export function buildChildChunks(parent: ParentChunk, parentIndex: number): ChildChunk[] {
  // Child chunks are text-only — images are stripped before embedding
  const text = stripImages(parent.content)
  const children: ChildChunk[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + CHILD_MAX_CHARS, text.length)

    let breakAt = end
    if (end < text.length) {
      const slice = text.slice(start, end)
      const lastSentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(".\n"))
      if (lastSentence > CHILD_MAX_CHARS / 2) {
        breakAt = start + lastSentence + 2
      }
    }

    const content = text.slice(start, breakAt).trim()
    if (content.length > 0) {
      children.push({
        content,
        pageNumber: parent.pageNumber,
        positionStart: parent.positionStart + start,
        parentIndex,
      })
    }

    start = breakAt - CHILD_OVERLAP_CHARS
    if (start < 0) start = 0
    if (breakAt >= text.length) break
  }

  return children
}

// Split content into atomic segments: text sentences and image markdown blocks
function splitIntoSegments(content: string): string[] {
  const segments: string[] = []
  let remaining = content

  while (remaining.length > 0) {
    const imgMatch = remaining.match(/!\[.*?\]\(s3:\/\/[^)]+\)/)
    if (!imgMatch || imgMatch.index === undefined) {
      // No more images — split remaining text into sentences
      const sentences = splitIntoSentences(remaining)
      segments.push(...sentences)
      break
    }

    // Text before the image
    const textBefore = remaining.slice(0, imgMatch.index).trim()
    if (textBefore) {
      segments.push(...splitIntoSentences(textBefore))
    }

    // Image as atomic segment
    segments.push(imgMatch[0])
    remaining = remaining.slice(imgMatch.index + imgMatch[0].length).trim()
  }

  return segments.filter((s) => s.length > 0)
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
