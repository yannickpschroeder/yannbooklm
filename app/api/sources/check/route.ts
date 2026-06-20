import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { sources, notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const notebookId = searchParams.get("notebookId")
  const hash = searchParams.get("hash")
  const url = searchParams.get("url")

  if (!notebookId || (!hash && !url)) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) return NextResponse.json({ error: "Notebook not found" }, { status: 404 })

  const condition = hash
    ? and(eq(sources.notebookId, notebookId), eq(sources.fileHash, hash))
    : and(eq(sources.notebookId, notebookId), eq(sources.url, url!))

  const [existing] = await db
    .select({ id: sources.id, title: sources.title })
    .from(sources)
    .where(and(condition, eq(sources.status, "ready")))
    .limit(1)

  return NextResponse.json({ duplicate: existing ?? null })
}
