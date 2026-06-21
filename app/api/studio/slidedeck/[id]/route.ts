import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { studioOutputs, notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"

async function resolveOutput(id: string, userId: string) {
  const [output] = await db
    .select({ notebookId: studioOutputs.notebookId, data: studioOutputs.data })
    .from(studioOutputs)
    .where(eq(studioOutputs.id, id))
    .limit(1)
  if (!output) return null

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, output.notebookId), eq(notebooks.userId, userId)))
    .limit(1)
  if (!notebook) return null

  return output
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = (await req.json()) as { title?: string; slidesUrl?: string; data?: unknown }

  const output = await resolveOutput(id, session.user.id)
  if (!output) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const patch: Record<string, unknown> = {}
  if (body.title?.trim()) patch.title = body.title.trim()
  if (body.data) {
    patch.data = body.data
  } else if (body.slidesUrl) {
    patch.data = { ...(output.data as object), slidesUrl: body.slidesUrl }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

  const [updated] = await db
    .update(studioOutputs)
    .set(patch)
    .where(eq(studioOutputs.id, id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const output = await resolveOutput(id, session.user.id)
  if (!output) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.delete(studioOutputs).where(eq(studioOutputs.id, id))
  return new NextResponse(null, { status: 204 })
}
