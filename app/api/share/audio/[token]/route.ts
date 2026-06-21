import { NextResponse } from "next/server"
import { db } from "@/db"
import { studioOutputs } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { s3, S3_BUCKET } from "@/lib/s3/client"
import type { AudioData } from "@/app/api/studio/audio/route"

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const [output] = await db
    .select({ data: studioOutputs.data })
    .from(studioOutputs)
    .where(eq(studioOutputs.shareToken, token))
    .limit(1)

  if (!output?.data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const data = output.data as AudioData

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: data.s3Key }),
    { expiresIn: 86400 }
  )

  return NextResponse.json({ url })
}
