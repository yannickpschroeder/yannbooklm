import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { studioOutputs, notebooks } from "@/db/schema"
import { and, eq, inArray } from "drizzle-orm"

const TIMEOUT_MS = process.env.VERCEL === "1" ? 30_000 : Infinity

// GET /api/studio/status?id=uuid1&id=uuid2
// Returns status (and full output when ready) for multiple studio outputs in one request.
// Generating entries older than TIMEOUT_MS are treated as timed out: deleted and returned as "timeout".
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const ids = url.searchParams.getAll("id").filter(Boolean)

  if (ids.length === 0) return NextResponse.json([])

  const rows = await db
    .select({
      output: studioOutputs,
      notebookUserId: notebooks.userId,
    })
    .from(studioOutputs)
    .innerJoin(notebooks, eq(notebooks.id, studioOutputs.notebookId))
    .where(
      and(
        inArray(studioOutputs.id, ids),
        eq(notebooks.userId, session.user.id)
      )
    )

  const now = Date.now()
  const timedOutIds: string[] = []

  const result = rows.map(({ output }) => {
    if (
      output.status === "generating" &&
      now - output.createdAt.getTime() > TIMEOUT_MS
    ) {
      timedOutIds.push(output.id)
      return { id: output.id, status: "timeout" as const }
    }
    return {
      id: output.id,
      status: output.status,
      output: output.status === "ready" ? output : undefined,
    }
  })

  if (timedOutIds.length > 0) {
    await db.delete(studioOutputs).where(inArray(studioOutputs.id, timedOutIds))
  }

  return NextResponse.json(result)
}
