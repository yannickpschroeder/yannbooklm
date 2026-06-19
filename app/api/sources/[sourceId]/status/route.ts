import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { sources, notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sourceId } = await params

  const [source] = await db
    .select({
      id: sources.id,
      status: sources.status,
      title: sources.title,
      notebookId: sources.notebookId,
    })
    .from(sources)
    .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
    .where(and(eq(sources.id, sourceId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ status: source.status, title: source.title })
}
