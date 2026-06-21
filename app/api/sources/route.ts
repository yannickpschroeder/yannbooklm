import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { after } from "next/server"
import { db } from "@/db"
import { sources, notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { ingestPdf, ingestUrl, ingestYoutube, ingestText } from "@/lib/ingestion/pipeline"
import { extractVideoId } from "@/lib/ingestion/youtube"

export const maxDuration = 300

type PdfPayload = { notebookId: string; type: "pdf"; title: string; s3Key: string; fileHash?: string }
type UrlPayload = { notebookId: string; type: "url"; url: string }
type TextPayload = { notebookId: string; type: "text"; title: string; text: string; fileHash?: string }
type Payload = PdfPayload | UrlPayload | TextPayload

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as Payload

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, body.notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) return NextResponse.json({ error: "Notebook not found" }, { status: 404 })

  if (body.type === "url") {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(body.url)
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Only http/https URLs allowed" }, { status: 400 })
    }

    const isYoutube = extractVideoId(body.url) !== null
    const sourceType = isYoutube ? "youtube" : "url"

    const [source] = await db
      .insert(sources)
      .values({ notebookId: body.notebookId, type: sourceType, title: parsedUrl.hostname, url: body.url, status: "pending" })
      .returning()

    after(async () => {
      if (isYoutube) {
        await ingestYoutube(source.id, body.url)
      } else {
        await ingestUrl(source.id, body.url)
      }
    })

    return NextResponse.json({ sourceId: source.id }, { status: 202 })
  }

  if (body.type === "text") {
    if (!body.text?.trim()) return NextResponse.json({ error: "Text is empty" }, { status: 400 })
    if (body.text.length > 10_000) return NextResponse.json({ error: "Text too long (max 10 000 chars)" }, { status: 400 })

    const [source] = await db
      .insert(sources)
      .values({ notebookId: body.notebookId, type: "text", title: body.title, fileHash: body.fileHash, status: "pending" })
      .returning()

    const capturedText = body.text
    after(async () => {
      await ingestText(source.id, capturedText)
    })

    return NextResponse.json({ sourceId: source.id }, { status: 202 })
  }

  // PDF
  const [source] = await db
    .insert(sources)
    .values({ notebookId: body.notebookId, type: "pdf", title: body.title, s3Key: body.s3Key, fileHash: body.fileHash, status: "pending" })
    .returning()

  after(async () => {
    await ingestPdf(source.id, body.s3Key)
  })

  return NextResponse.json({ sourceId: source.id }, { status: 202 })
}
