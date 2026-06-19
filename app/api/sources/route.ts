import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { after } from "next/server"
import { db } from "@/db"
import { sources, notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { ingestPdf } from "@/lib/ingestion/pipeline"

export const maxDuration = 10

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { notebookId, type, title, s3Key } = (await req.json()) as {
    notebookId: string
    type: "pdf"
    title: string
    s3Key: string
  }

  // Verify notebook belongs to user
  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) return NextResponse.json({ error: "Notebook not found" }, { status: 404 })

  const [source] = await db
    .insert(sources)
    .values({ notebookId, type, title, s3Key, status: "pending" })
    .returning()

  // Run ingestion after response is sent
  after(async () => {
    if (type === "pdf") {
      await ingestPdf(source.id, s3Key!)
    }
  })

  return NextResponse.json({ sourceId: source.id }, { status: 202 })
}
