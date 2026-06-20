import { GetObjectCommand } from "@aws-sdk/client-s3"
import { resolve } from "path"
import { s3, S3_BUCKET } from "@/lib/s3/client"

export interface PdfPage {
  pageNumber: number
  text: string
}

export interface PdfParseResult {
  pages: PdfPage[]
  totalPages: number
}

async function downloadFromS3(s3Key: string): Promise<Uint8Array> {
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key })
  const res = await s3.send(cmd)
  const bytes = await res.Body!.transformToByteArray()
  return bytes
}

export async function parsePdf(s3Key: string): Promise<PdfParseResult> {
  const data = await downloadFromS3(s3Key)

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")

  // pdfjs v5 requires an explicit workerSrc even for the Node.js fake-worker path
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")}`

  const pdf = await pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise

  const pages: PdfPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    const text = content.items
      .filter((item) => "str" in item)
      .map((item) => (item as { str: string }).str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()

    if (text.length > 0) {
      pages.push({ pageNumber: i, text })
    }
  }

  return { pages, totalPages: pdf.numPages }
}
