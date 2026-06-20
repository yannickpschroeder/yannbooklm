import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { s3, S3_BUCKET } from "@/lib/s3/client"
import * as mupdf from "mupdf"

export interface PdfPage {
  pageNumber: number
  // Markdown with text and ![](s3://key) image references interleaved by Y-position
  content: string
}

export interface PdfParseResult {
  pages: PdfPage[]
  totalPages: number
}

const MIN_IMAGE_PX = 100

async function downloadFromS3(s3Key: string): Promise<Uint8Array> {
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key })
  const res = await s3.send(cmd)
  return res.Body!.transformToByteArray()
}

async function uploadImageToS3(key: string, png: Uint8Array): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: png,
      ContentType: "image/png",
    }),
  )
}

type TextBlock = { y: number; type: "text"; text: string }
type ImageBlock = { y: number; type: "image"; png: Uint8Array; key: string }
type Block = TextBlock | ImageBlock

export async function parsePdf(s3Key: string, sourceId: string): Promise<PdfParseResult> {
  const data = await downloadFromS3(s3Key)
  const doc = mupdf.Document.openDocument(data, "application/pdf")
  const totalPages = doc.countPages()
  const pages: PdfPage[] = []

  for (let i = 0; i < totalPages; i++) {
    const page = doc.loadPage(i)
    const st = page.toStructuredText("preserve-images")
    const blocks: Block[] = []

    let curBlockY = 0
    let curLines: string[] = []
    let curChars: string[] = []
    let imgIdx = 0
    const seenBboxes = new Set<string>()

    st.walk({
      beginTextBlock(bbox: number[]) {
        curBlockY = bbox[1]
        curLines = []
      },
      endTextBlock() {
        const text = curLines.join("\n").trim()
        if (text) blocks.push({ y: curBlockY, type: "text", text })
      },
      beginLine() {
        curChars = []
      },
      endLine() {
        const line = curChars.join("").trim()
        if (line) curLines.push(line)
        curChars = []
      },
      onChar(char: string) {
        curChars.push(char)
      },
      onImageBlock(bbox: number[], _transform: unknown, image: mupdf.Image) {
        const w = image.getWidth()
        const h = image.getHeight()
        if (w < MIN_IMAGE_PX || h < MIN_IMAGE_PX) return

        // Deduplicate images at the same position (PDF often references same image via mask/group)
        const bboxKey = `${Math.round(bbox[0])},${Math.round(bbox[1])},${Math.round(bbox[2])},${Math.round(bbox[3])}`
        if (seenBboxes.has(bboxKey)) return
        seenBboxes.add(bboxKey)

        const key = `sources/${sourceId}/images/page${i + 1}-img${imgIdx++}.png`
        const png = image.toPixmap().asPNG()
        blocks.push({ y: bbox[1], type: "image", png, key })
      },
    })

    blocks.sort((a, b) => a.y - b.y)

    const uploads: Promise<void>[] = []
    const parts: string[] = []

    for (const block of blocks) {
      if (block.type === "text") {
        parts.push(block.text)
      } else {
        parts.push(`![](s3://${block.key})`)
        uploads.push(uploadImageToS3(block.key, block.png))
      }
    }

    await Promise.all(uploads)

    const content = parts.join("\n\n").trim()
    if (content) pages.push({ pageNumber: i + 1, content })
  }

  return { pages, totalPages }
}
