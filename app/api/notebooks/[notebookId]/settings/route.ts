import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

const bodySchema = z.object({
  outputLanguage: z.string().nullable(),
  applyToAll: z.boolean().optional().default(false),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ notebookId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { notebookId } = await params
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 })

  const { outputLanguage, applyToAll } = parsed.data

  if (applyToAll) {
    await db
      .update(notebooks)
      .set({ outputLanguage, updatedAt: new Date() })
      .where(eq(notebooks.userId, session.user.id))
  } else {
    const [row] = await db
      .update(notebooks)
      .set({ outputLanguage, updatedAt: new Date() })
      .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
      .returning()

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
