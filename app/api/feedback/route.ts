import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { feedback } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { z } from "zod"

const bodySchema = z.object({ content: z.string().min(1).max(10000) })

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await db
    .select()
    .from(feedback)
    .where(eq(feedback.userId, session.user.id))
    .orderBy(desc(feedback.createdAt))

  return NextResponse.json(rows)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 })

  const [row] = await db
    .insert(feedback)
    .values({ userId: session.user.id, content: parsed.data.content })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
