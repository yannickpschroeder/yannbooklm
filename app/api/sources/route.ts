import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { after } from "next/server"
import { db } from "@/db"
import { sources, notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { ingestPdf, ingestUrl, ingestYoutube } from "@/lib/ingestion/pipeline"
import { extractVideoId } from "@/lib/ingestion/youtube"

export const maxDuration = 10

type PdfPayload = { notebookId: string; type: "pdf"; title: string; s3Key: string; fileHash?: string }
type UrlPayload = { notebookId: string; type: "url"; url: string }
type Payload = PdfPayload | UrlPayload

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
