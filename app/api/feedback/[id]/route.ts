import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { feedback } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

const bodySchema = z.object({ content: z.string().min(1).max(10000) })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 })

  const [row] = await db
    .update(feedback)
    .set({ content: parsed.data.content, updatedAt: new Date() })
    .where(and(eq(feedback.id, id), eq(feedback.userId, session.user.id)))
    .returning()

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  await db
    .delete(feedback)
    .where(and(eq(feedback.id, id), eq(feedback.userId, session.user.id)))

  return new NextResponse(null, { status: 204 })
}
