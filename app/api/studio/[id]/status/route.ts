import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { studioOutputs, notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const [output] = await db
    .select()
    .from(studioOutputs)
    .where(eq(studioOutputs.id, id))
    .limit(1)

  if (!output) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, output.notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (output.status === "ready") {
    return NextResponse.json({ status: "ready", output })
  }

  return NextResponse.json({ status: output.status })
}
