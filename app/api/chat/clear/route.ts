import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { messages, notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

const bodySchema = z.object({ notebookId: z.string().uuid() })

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 })

  const { notebookId } = parsed.data

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))

  if (!notebook) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.delete(messages).where(eq(messages.notebookId, notebookId))

  return new NextResponse(null, { status: 204 })
}
