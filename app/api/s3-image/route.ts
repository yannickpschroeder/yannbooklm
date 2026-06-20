import { auth } from "@/lib/auth"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { s3, S3_BUCKET } from "@/lib/s3/client"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const key = new URL(req.url).searchParams.get("key")
  if (!key) return new Response("Missing key", { status: 400 })

  // Restrict to image paths only — prevent arbitrary S3 key access
  if (!key.startsWith("sources/") || !key.includes("/images/")) {
    return new Response("Forbidden", { status: 403 })
  }

  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    const bytes = await res.Body!.transformToByteArray()
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": res.ContentType ?? "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
