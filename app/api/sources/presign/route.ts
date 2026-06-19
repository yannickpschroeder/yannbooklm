import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { s3, S3_BUCKET } from "@/lib/s3/client"
import { randomUUID } from "crypto"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { filename, contentType } = (await req.json()) as {
    filename: string
    contentType: string
  }

  if (!contentType.startsWith("application/pdf")) {
    return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 })
  }

  const s3Key = `uploads/${session.user.id}/${randomUUID()}/${filename}`

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      ContentType: contentType,
    }),
    { expiresIn: 300 }
  )

  return NextResponse.json({ presignedUrl: url, s3Key })
}
