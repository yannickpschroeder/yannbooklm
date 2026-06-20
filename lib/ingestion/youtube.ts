import { buildParentChunks, buildChildChunks } from "./chunking"
import type { ParentChunk, ChildChunk } from "./chunking"

interface TranscriptSegment {
  text: string
  offset: number // ms
  duration: number // ms
}

// Seconds per parent-level window before text-token limit kicks in
const WINDOW_SECONDS = 120

export function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

export async function fetchYoutubeContent(url: string): Promise<{
  title: string
  parentChunks: (ParentChunk & { startSeconds: number })[]
  childChunks: ChildChunk[]
}> {
  const videoId = extractVideoId(url)
  if (!videoId) throw new Error("Invalid YouTube URL")

  const { YoutubeTranscript } = await import("youtube-transcript")
  const segments = (await YoutubeTranscript.fetchTranscript(videoId)) as TranscriptSegment[]
  if (!segments?.length) throw new Error("No transcript available for this video")

  const title = await fetchTitle(url, videoId)

  // Group segments into WINDOW_SECONDS buckets; pageNumber = bucket start in seconds
  const buckets = new Map<number, string[]>()
  for (const seg of segments) {
    const bucketStart = Math.floor(seg.offset / 1000 / WINDOW_SECONDS) * WINDOW_SECONDS
    if (!buckets.has(bucketStart)) buckets.set(bucketStart, [])
    buckets.get(bucketStart)!.push(seg.text.replace(/\n/g, " ").trim())
  }

  const pages = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([startSec, texts]) => ({ pageNumber: startSec, text: texts.join(" ") }))

  // pageNumber (= start second) is propagated through parent → child by the chunking algo
  const parents = buildParentChunks(pages)
  const children = parents.flatMap((p, i) => buildChildChunks(p, i))

  // For YouTube: override positionStart on parent chunks to be seconds too
  const parentsWithSeconds = parents.map((p) => ({
    ...p,
    positionStart: p.pageNumber ?? 0,
    positionEnd: (p.pageNumber ?? 0) + WINDOW_SECONDS,
    startSeconds: p.pageNumber ?? 0,
  }))

  // Child chunks: positionStart = parent's startSeconds (same for all siblings)
  const childrenWithSeconds = children.map((c) => ({
    ...c,
    positionStart: parentsWithSeconds[c.parentIndex]?.startSeconds ?? 0,
  }))

  return { title, parentChunks: parentsWithSeconds, childChunks: childrenWithSeconds }
}

async function fetchTitle(url: string, videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(8_000) }
    )
    if (res.ok) {
      const { title } = (await res.json()) as { title: string }
      if (title) return title
    }
  } catch {
    // fall through to videoId as fallback
  }
  return videoId
}
