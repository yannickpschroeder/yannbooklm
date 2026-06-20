import { randomUUID } from "crypto"
import { db } from "@/db"
import { sources, parentChunks, childChunks } from "@/db/schema"
import { eq } from "drizzle-orm"
import { DeleteObjectCommand } from "@aws-sdk/client-s3"
import { s3, S3_BUCKET } from "@/lib/s3/client"
import { parsePdf } from "./pdf"
import { scrapeUrl } from "./web"
import { buildParentChunks, buildChildChunks } from "./chunking"
import { embedBatch } from "@/lib/ai/voyage"
import type { PdfPage } from "./pdf"

const EMBED_BATCH_SIZE = 16
const INTER_BATCH_DELAY_MS = 300

export async function ingestUrl(sourceId: string, url: string): Promise<void> {
  try {
    await db.update(sources).set({ status: "processing" }).where(eq(sources.id, sourceId))
    const { title, pages } = await scrapeUrl(url)
    await db.update(sources).set({ title }).where(eq(sources.id, sourceId))
    await ingestPages(sourceId, pages)
    await db.update(sources).set({ status: "ready" }).where(eq(sources.id, sourceId))
  } catch (err) {
    console.error(`[ingest] URL ingestion failed for source ${sourceId}:`, err)
    await db.delete(sources).where(eq(sources.id, sourceId))
  }
}

export async function ingestPdf(sourceId: string, s3Key: string): Promise<void> {
  try {
    await db.update(sources).set({ status: "processing" }).where(eq(sources.id, sourceId))
    const { pages } = await parsePdf(s3Key)
    await ingestPages(sourceId, pages)
    await db.update(sources).set({ status: "ready" }).where(eq(sources.id, sourceId))
  } catch (err) {
    console.error(`[ingest] PDF ingestion failed for source ${sourceId}:`, err)
    await Promise.allSettled([
      db.delete(sources).where(eq(sources.id, sourceId)),
      s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key })),
    ])
  }
}

async function ingestPages(sourceId: string, pages: PdfPage[]): Promise<void> {
  const parentChunkData = buildParentChunks(pages)

  // Assign IDs client-side so child chunks can reference them directly
  const parentsWithIds = parentChunkData.map((p) => ({
    id: randomUUID() as string,
    sourceId,
    content: p.content,
    pageNumber: p.pageNumber,
    positionStart: p.positionStart,
    positionEnd: p.positionEnd,
  }))

  console.log(`[ingest] Inserting ${parentsWithIds.length} parent chunks for source ${sourceId}`)
  await db.insert(parentChunks).values(parentsWithIds)
  console.log(`[ingest] Parent chunks inserted, IDs: ${parentsWithIds.map((p) => p.id).join(", ")}`)

  const allChildren = parentChunkData.flatMap((parent, i) =>
    buildChildChunks(parent, i).map((child) => ({
      ...child,
      parentId: parentsWithIds[i].id,
    }))
  )

  console.log(`[ingest] ${allChildren.length} child chunks to embed, unique parentIds: ${[...new Set(allChildren.map((c) => c.parentId))].length}`)

  const totalBatches = Math.ceil(allChildren.length / EMBED_BATCH_SIZE)

  for (let i = 0; i < allChildren.length; i += EMBED_BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS))
    const batch = allChildren.slice(i, i + EMBED_BATCH_SIZE)
    const embeddings = await embedBatch(batch.map((c) => c.content))

    const batchIndex = Math.floor(i / EMBED_BATCH_SIZE)
    const progress = Math.round(((batchIndex + 1) / totalBatches) * 100)
    const batchParentIds = [...new Set(batch.map((c) => c.parentId))]
    console.log(`[ingest] Batch ${batchIndex + 1}/${totalBatches}: inserting ${batch.length} children, parentIds: ${batchParentIds.join(", ")}`)

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
