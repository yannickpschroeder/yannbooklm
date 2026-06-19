"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Upload, FileText } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

type UploadState = "idle" | "uploading" | "processing" | "done" | "error"

export function AddPdfDialog({
  notebookId,
  open,
  onOpenChange,
}: {
  notebookId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("sources")
  const tc = useTranslations("common")
  const [dragActive, setDragActive] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [progress, setProgress] = useState(0)

  async function handleFile(file: File) {
    if (!file.type.includes("pdf")) {
      toast.error("Nur PDF-Dateien erlaubt")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Datei zu groß (max. 50 MB)")
      return
    }

    setUploadState("uploading")
    setProgress(0)

    try {
      // 1. Get presigned URL
      const presignRes = await fetch("/api/sources/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      if (!presignRes.ok) throw new Error("Presign failed")
      const { presignedUrl, s3Key } = (await presignRes.json()) as {
        presignedUrl: string
        s3Key: string
      }

      // 2. Upload to S3
      await uploadWithProgress(file, presignedUrl, setProgress)

      // 3. Create source + trigger ingest
      setUploadState("processing")
      const sourceRes = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          type: "pdf",
          title: file.name.replace(/\.pdf$/i, ""),
          s3Key,
        }),
      })
      if (!sourceRes.ok) throw new Error("Source creation failed")
      const { sourceId } = (await sourceRes.json()) as { sourceId: string }

      // 4. Poll for status
      await pollStatus(sourceId)

      setUploadState("done")
      toast.success(t("uploadSuccess"))
      onOpenChange(false)
      // Trigger page refresh so source list updates
      window.location.reload()
    } catch (err) {
      console.error(err)
      setUploadState("error")
      toast.error(tc("error"))
    }
  }

  async function pollStatus(sourceId: string) {
    const maxAttempts = 120 // 4 minutes at 2s interval
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const res = await fetch(`/api/sources/${sourceId}/status`)
      if (!res.ok) continue
      const { status } = (await res.json()) as { status: string }
      if (status === "ready") return
      if (status === "error") throw new Error("Ingestion failed")
    }
    throw new Error("Ingestion timed out")
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [notebookId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [notebookId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const isProcessing = uploadState === "uploading" || uploadState === "processing"

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addPdf")}</DialogTitle>
        </DialogHeader>

        {uploadState === "idle" || uploadState === "error" ? (
          <label
            className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
          >
            <Upload className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">{dragActive ? t("dragActive") : t("pdfDropzone")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("pdfDropzoneHint")}</p>
            </div>
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={onInputChange}
            />
          </label>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            <FileText className="size-10 text-primary" />
            <div className="w-full space-y-2">
              <p className="text-center text-sm font-medium">
                {uploadState === "uploading" ? t("uploading") : t("processing")}
              </p>
              {uploadState === "uploading" && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              {uploadState === "processing" && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-full animate-pulse bg-primary" />
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

async function uploadWithProgress(
  file: File,
  presignedUrl: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", presignedUrl)
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`S3 upload ${xhr.status}`)))
    xhr.onerror = () => reject(new Error("Upload failed"))
    xhr.send(file)
  })
}
