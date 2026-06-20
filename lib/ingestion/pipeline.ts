import { randomUUID } from "crypto"
import { db } from "@/db"
import { sources, parentChunks, childChunks } from "@/db/schema"
import { eq } from "drizzle-orm"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { s3, S3_BUCKET } from "@/lib/s3/client"
import { parsePdf } from "./pdf"
import { scrapeUrl } from "./web"
import { fetchYoutubeContent } from "./youtube"
import { buildParentChunks, buildChildChunks } from "./chunking"
import { embedBatch } from "@/lib/ai/voyage"
import { generateText } from "ai"
import { claude } from "@/lib/ai/anthropic"
import type { PdfPage } from "./pdf"
import type { ParentChunk, ChildChunk } from "./chunking"

const EMBED_BATCH_SIZE = 16
const INTER_BATCH_DELAY_MS = 300
// First ~6 000 chars of text is enough for a concise summary
const SUMMARY_TEXT_LIMIT = 6000

async function generateSummary(pages: PdfPage[]): Promise<string> {
  const text = pages
    .map((p) => p.content.replace(/!\[.*?\]\([^)]+\)/g, ""))
    .join("\n\n")
    .slice(0, SUMMARY_TEXT_LIMIT)

  const { text: summary } = await generateText({
    model: claude,
    messages: [
      {
        role: "user",
        content:
          `Summarize the following document in 3-5 German sentences. ` +
          `Describe what the document is about, its structure, and the key topics it covers. ` +
          `Be specific about the content — avoid generic phrases like "the document provides information about".\n\n` +
          `Document:\n${text}`,
      },
    ],
  })
  return summary.trim()
}

export async function ingestUrl(sourceId: string, url: string): Promise<void> {
  try {
    await db.update(sources).set({ status: "processing" }).where(eq(sources.id, sourceId))
    const { title, pages } = await scrapeUrl(url)
    await db.update(sources).set({ title }).where(eq(sources.id, sourceId))
    await ingestPages(sourceId, pages)
    const summary = await generateSummary(pages)
    await db.update(sources).set({ status: "ready", summary }).where(eq(sources.id, sourceId))
  } catch (err) {
    console.error(`[ingest] URL ingestion failed for source ${sourceId}:`, err)
    await db.delete(sources).where(eq(sources.id, sourceId))
  }
}

export async function ingestYoutube(sourceId: string, url: string): Promise<void> {
  try {
    await db.update(sources).set({ status: "processing" }).where(eq(sources.id, sourceId))
    const { title, parentChunks: parents, childChunks: children } = await fetchYoutubeContent(url)
    await db.update(sources).set({ title }).where(eq(sources.id, sourceId))
    await ingestPrebuiltChunks(sourceId, parents, children)
    const pages = parents.map((p) => ({ pageNumber: p.pageNumber, content: p.content }))
    const summary = await generateSummary(pages)
    await db.update(sources).set({ status: "ready", summary }).where(eq(sources.id, sourceId))
  } catch (err) {
    console.error(`[ingest] YouTube ingestion failed for source ${sourceId}:`, err)
    await db.delete(sources).where(eq(sources.id, sourceId))
  }
}

export async function ingestPdf(sourceId: string, s3Key: string): Promise<void> {
  try {
    await db.update(sources).set({ status: "processing" }).where(eq(sources.id, sourceId))
    const { pages } = await parsePdf(s3Key, sourceId)
    await ingestPages(sourceId, pages)
    const summary = await generateSummary(pages)
    await db.update(sources).set({ status: "ready", summary }).where(eq(sources.id, sourceId))
  } catch (err) {
    console.error(`[ingest] PDF ingestion failed for source ${sourceId}:`, err)
    await Promise.allSettled([
      db.delete(sources).where(eq(sources.id, sourceId)),
      s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key })),
    ])
  }
}

async function ingestPrebuiltChunks(
  sourceId: string,
  parents: (ParentChunk & { startSeconds?: number })[],
  children: (ChildChunk & { parentIndex: number })[]
): Promise<void> {
  const parentsWithIds = parents.map((p) => ({
    id: randomUUID() as string,
    sourceId,
    content: p.content,
    pageNumber: p.pageNumber,
    positionStart: p.positionStart,
    positionEnd: p.positionEnd,
  }))

  await db.insert(parentChunks).values(parentsWithIds)

  const allChildren = children.map((child) => ({
    ...child,
    parentId: parentsWithIds[child.parentIndex].id,
  }))

  await embedAndInsertChildren(sourceId, allChildren)
}

async function ingestPages(sourceId: string, pages: PdfPage[]): Promise<void> {
  const parentChunkData = buildParentChunks(pages)

  const parentsWithIds = parentChunkData.map((p) => ({
    id: randomUUID() as string,
    sourceId,
    content: p.content,
    pageNumber: p.pageNumber,
    positionStart: p.positionStart,
    positionEnd: p.positionEnd,
  }))

  await db.insert(parentChunks).values(parentsWithIds)

  const allChildren = parentChunkData.flatMap((parent, i) =>
    buildChildChunks(parent, i).map((child) => ({
      ...child,
      parentId: parentsWithIds[i].id,
    }))
  )

  await embedAndInsertChildren(sourceId, allChildren)
}

type EmbeddableChild = {
  content: string
  pageNumber: number
  positionStart: number
  parentId: string
}

async function embedAndInsertChildren(sourceId: string, allChildren: EmbeddableChild[]): Promise<void> {
  const totalBatches = Math.ceil(allChildren.length / EMBED_BATCH_SIZE)

  for (let i = 0; i < allChildren.length; i += EMBED_BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS))
    const batch = allChildren.slice(i, i + EMBED_BATCH_SIZE)
    const embeddings = await embedBatch(batch.map((c) => c.content))

    const batchIndex = Math.floor(i / EMBED_BATCH_SIZE)
    const progress = Math.round(((batchIndex + 1) / totalBatches) * 100)

    await Promise.all([
      db.insert(childChunks).values(
        batch.map((child, j) => ({
          sourceId,
          parentChunkId: child.parentId,
          content: child.content,
          embedding: embeddings[j],
          pageNumber: child.pageNumber,
          positionStart: child.positionStart,
        }))
      ),
      db.update(sources).set({ embedProgress: progress }).where(eq(sources.id, sourceId)),
    ])
  }
}
