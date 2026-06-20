"use client"

import { useCallback, useRef, useState } from "react"

async function pollStatus(sourceId: string): Promise<void> {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const res = await fetch(`/api/sources/${sourceId}/status`)
    if (!res.ok) continue
    const { status } = (await res.json()) as { status: string }
    if (status === "ready") return
    if (status === "error") throw new Error("Verarbeitung fehlgeschlagen")
  }
  throw new Error("Timeout beim Verarbeiten")
}
import { toast } from "sonner"
import {
  Upload,
  Globe,
  Loader2,
  Search,
  ChevronDown,
  Link,
  ArrowLeft,
} from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const MAX_FILE_SIZE = 50 * 1024 * 1024

type View = "pick" | "pdf-uploading" | "url-input" | "url-processing"

export function AddSourceModal({
  notebookId,
  open,
  onOpenChange,
  sourceCount,
  sourceLimit,
}: {
  notebookId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceCount: number
  sourceLimit?: number
}) {
  const limit = sourceLimit ?? 50
  const [view, setView] = useState<View>("pick")
  const [progress, setProgress] = useState(0)
  const [url, setUrl] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setView("pick")
    setProgress(0)
    setUrl("")
  }

  function handleClose(o: boolean) {
    if (!o) reset()
    onOpenChange(o)
  }

  // ── PDF ──────────────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    if (!file.type.includes("pdf")) {
      toast.error("Nur PDF-Dateien erlaubt")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Datei zu groß (max. 50 MB)")
      return
    }

    // Compute SHA-256 and check for duplicate before starting upload
    const fileHash = await computeSha256(file)
    const checkRes = await fetch(
      `/api/sources/check?notebookId=${encodeURIComponent(notebookId)}&hash=${encodeURIComponent(fileHash)}`
    )
    if (checkRes.ok) {
      const { duplicate } = (await checkRes.json()) as { duplicate: { title: string } | null }
      if (duplicate) {
        toast.warning(`Diese Datei wurde bereits hinzugefügt: „${duplicate.title}"`)
        return
      }
    }

    setView("pdf-uploading")
    setProgress(0)

    try {
      const presignRes = await fetch("/api/sources/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      if (!presignRes.ok) throw new Error("Presign fehlgeschlagen")
      const { presignedUrl, s3Key } = (await presignRes.json()) as {
        presignedUrl: string
        s3Key: string
      }

      await uploadWithProgress(file, presignedUrl, setProgress)

      const sourceRes = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          type: "pdf",
          title: file.name.replace(/\.pdf$/i, ""),
          s3Key,
          fileHash,
        }),
      })
      if (!sourceRes.ok) throw new Error("Quelle konnte nicht erstellt werden")
      const { sourceId } = (await sourceRes.json()) as { sourceId: string }

      await pollStatus(sourceId)
      toast.success("Datei wurde hinzugefügt")
      handleClose(false)
      window.location.reload()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen")
      setView("pick")
    }
  }

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ""
    },
    [notebookId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [notebookId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ── URL ──────────────────────────────────────────────────────────────────────

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault()
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      toast.error("Bitte eine gültige http/https-URL eingeben")
      return
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      toast.error("Nur http/https-URLs erlaubt")
      return
    }

    // Check if URL was already added to this notebook
    const checkRes = await fetch(
      `/api/sources/check?notebookId=${encodeURIComponent(notebookId)}&url=${encodeURIComponent(url)}`
    )
    if (checkRes.ok) {
      const { duplicate } = (await checkRes.json()) as { duplicate: { title: string } | null }
      if (duplicate) {
        toast.warning(`Diese URL wurde bereits hinzugefügt: „${duplicate.title}"`)
        return
      }
    }

    setView("url-processing")
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, type: "url", url }),
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string }
        throw new Error(error ?? "Unbekannter Fehler")
      }
      const { sourceId } = (await res.json()) as { sourceId: string }
      await pollStatus(sourceId)
      toast.success("Webseite wurde hinzugefügt")
      handleClose(false)
      window.location.reload()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Fehler beim Hinzufügen")
      setView("url-input")
    }
  }

  const isProcessing = view === "pdf-uploading" || view === "url-processing"

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : handleClose}>
      <DialogContent className="sm:max-w-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold leading-snug">
            {view === "url-input" || view === "url-processing" ? (
              "Webseite hinzufügen"
            ) : (
              <>
                Ihre{" "}
                <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                  Quellen
                </span>{" "}
                in fundierte Antworten verwandeln
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Picker ───────────────────────────────────────────────────────── */}
        {view === "pick" && (
          <div className="space-y-4">
            {/* Web search bar (placeholder – not yet functional) */}
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                placeholder="Im Web nach neuen Quellen suchen"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                disabled
              />
              <div className="flex items-center gap-1">
                <button
                  disabled
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground"
                >
                  <Globe className="size-3.5" />
                  Web
                  <ChevronDown className="size-3" />
                </button>
              </div>
            </div>

            {/* Drop zone */}
            <label
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <Upload className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium">oder laden Sie Ihre Dateien hoch</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  PDF, Bilder, Dokumente, Audio und mehr
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={onInputChange}
              />
            </label>

            {/* Action buttons */}
            <div className="grid grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="flex-col gap-1.5 h-auto py-4 whitespace-normal text-center"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-5 shrink-0" />
                <span className="text-xs leading-tight">Dateien hochladen</span>
              </Button>
              <Button
                variant="outline"
                className="flex-col gap-1.5 h-auto py-4 whitespace-normal text-center"
                onClick={() => setView("url-input")}
              >
                <div className="flex items-center gap-1 shrink-0">
                  <Link className="size-4" />
                  <FaYoutube className="size-4 text-red-500" />
                </div>
                <span className="text-xs leading-tight">Websites</span>
              </Button>
              <Button
                variant="outline"
                className="flex-col gap-1.5 h-auto py-4 whitespace-normal text-center"
                disabled
                title="Noch nicht verfügbar"
              >
                <span className="text-xl leading-none shrink-0">▲</span>
                <span className="text-xs leading-tight">Drive</span>
              </Button>
              <Button
                variant="outline"
                className="flex-col gap-1.5 h-auto py-4 whitespace-normal text-center"
                disabled
                title="Noch nicht verfügbar"
              >
                <span className="text-xl leading-none shrink-0">📋</span>
                <span className="text-xs leading-tight">Kopierter Text</span>
              </Button>
            </div>

            {/* Progress indicator */}
            <div className="space-y-1">
              <div className="flex justify-end">
                <span className="text-xs text-muted-foreground">
                  {sourceCount}/{limit}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min((sourceCount / limit) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── PDF uploading ────────────────────────────────────────────────── */}
        {view === "pdf-uploading" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="size-10 animate-spin text-primary" />
            <div className="w-full space-y-2 text-center">
              <p className="text-sm font-medium">
                {progress < 100 ? "Datei wird hochgeladen…" : "Wird verarbeitet…"}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                {progress < 100 ? (
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-primary" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── URL input ────────────────────────────────────────────────────── */}
        {view === "url-input" && (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setView("pick")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Zurück
            </button>
            <div className="space-y-1.5">
              <label htmlFor="url-input" className="text-sm font-medium">
                URL
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://example.com/artikel"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-9"
                  autoFocus
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Unterstützt Blog-Posts, Artikel und Dokumentation. JS-gerenderte SPAs
                werden möglicherweise nicht vollständig unterstützt.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setView("pick")}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={!url}>
                Hinzufügen
              </Button>
            </div>
          </form>
        )}

        {/* ── URL processing ───────────────────────────────────────────────── */}
        {view === "url-processing" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="size-10 animate-spin text-primary" />
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium">Webseite wird verarbeitet…</p>
              <p className="text-xs text-muted-foreground">
                Inhalt wird gelesen und indiziert
              </p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full animate-pulse bg-primary" />
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
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`S3 ${xhr.status}`)))
    xhr.onerror = () => reject(new Error("Upload fehlgeschlagen"))
    xhr.send(file)
  })
}

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
