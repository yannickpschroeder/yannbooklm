import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/db"
import { studioOutputs, notebooks } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { s3, S3_BUCKET } from "@/lib/s3/client"
import type { AudioData } from "../route"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const [output] = await db
    .select({ data: studioOutputs.data, notebookId: studioOutputs.notebookId })
    .from(studioOutputs)
    .where(eq(studioOutputs.id, id))
    .limit(1)

  if (!output?.data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [notebook] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, output.notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const data = output.data as AudioData

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: data.s3Key }),
    { expiresIn: 3600 }
  )

  return NextResponse.json({ url })
}
