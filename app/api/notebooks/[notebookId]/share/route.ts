import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import type { NotebookShareScope } from "@/db/schema"

const postSchema = z.object({
  scope: z.enum(["sources_chat", "sources_chat_studio"]),
})

export async function POST(req: Request, { params }: { params: Promise<{ notebookId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { notebookId } = await params
  const parsed = postSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 })

  const [existing] = await db
    .select({ shareToken: notebooks.shareToken })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const token = existing.shareToken ?? crypto.randomUUID()

  await db
    .update(notebooks)
    .set({ shareToken: token, shareScope: parsed.data.scope as NotebookShareScope, updatedAt: new Date() })
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))

  return NextResponse.json({ token })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ notebookId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { notebookId } = await params

  await db
    .update(notebooks)
    .set({ shareToken: null, shareScope: null, updatedAt: new Date() })
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))

  return new NextResponse(null, { status: 204 })
}
