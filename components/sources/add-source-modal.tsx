"use client"

import { useCallback, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  Upload,
  Globe,
  Loader2,
  Search,
  ChevronDown,
  Link,
  ArrowLeft,
  X,
} from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deleteSource } from "@/lib/actions/sources"
import { devTodo } from "@/lib/dev-todo"
import { openDrivePicker, downloadDriveFile } from "@/lib/google-drive-picker"

const MAX_FILE_SIZE = 50 * 1024 * 1024

type View = "pick" | "pdf-uploading" | "url-input" | "url-processing" | "text-input" | "text-processing" | "drive-downloading"

const TEXT_MAX_CHARS = 10_000

async function pollStatus(
  sourceId: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  for (let i = 0; i < 300; i++) {
    if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError")
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, 2000)
      signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Abgebrochen", "AbortError")) }, { once: true })
    })
    if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError")
    const res = await fetch(`/api/sources/${sourceId}/status`, { signal })
    if (res.status === 404) throw new Error("Verarbeitung fehlgeschlagen")
    if (!res.ok) continue
    const { status, embedProgress } = (await res.json()) as { status: string; embedProgress: number }
    if (embedProgress > 0) onProgress?.(embedProgress)
    if (status === "ready") return
    if (status === "error") throw new Error("Verarbeitung fehlgeschlagen")
  }
  throw new Error("Timeout beim Verarbeiten")
}

async function uploadWithProgress(
  file: File,
  presignedUrl: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    signal?.addEventListener("abort", () => { xhr.abort(); reject(new DOMException("Abgebrochen", "AbortError")) }, { once: true })
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

export function AddSourceModal({
  notebookId,
  open,
  onOpenChange,
  sourceCount,
  sourceLimit,
  onMinimize,
}: {
  notebookId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceCount: number
  sourceLimit?: number
  onMinimize?: (sourceId: string, title: string) => void
}) {
  const t = useTranslations("sources")
  const limit = sourceLimit ?? 50
  const [view, setView] = useState<View>("pick")
  const [progress, setProgress] = useState(0)
  const [embedProgress, setEmbedProgress] = useState(0)
  const [url, setUrl] = useState("")
  const [pastedText, setPastedText] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  // Track current upload so cancel/minimize can reference it
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentSourceIdRef = useRef<string | null>(null)
  const currentTitleRef = useRef<string>("")
  const minimizingRef = useRef(false)
  const [sourceCreated, setSourceCreated] = useState(false)

  function reset() {
    setView("pick")
    setProgress(0)
    setEmbedProgress(0)
    setUrl("")
    setPastedText("")
    setSourceCreated(false)
    currentSourceIdRef.current = null
    currentTitleRef.current = ""
    minimizingRef.current = false
  }

  const isUploading = view === "pdf-uploading" && progress < 100
  const isEmbedding =
    (view === "pdf-uploading" && progress >= 100) || view === "url-processing" || view === "text-processing"
  const isProcessing = isUploading || isEmbedding || view === "drive-downloading"
  const canMinimize = view !== "text-processing" && isEmbedding && sourceCreated

  async function handleCancel() {
    minimizingRef.current = false
    abortControllerRef.current?.abort()
  }

  function handleMinimize() {
    if (!currentSourceIdRef.current) return
    minimizingRef.current = true
    abortControllerRef.current?.abort()
    onMinimize?.(currentSourceIdRef.current, currentTitleRef.current)
    reset()
    onOpenChange(false)
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

    const title = file.name.replace(/\.pdf$/i, "")
    currentTitleRef.current = title

    const ac = new AbortController()
    abortControllerRef.current = ac

    setView("pdf-uploading")
    setProgress(0)
    setEmbedProgress(0)

    try {
      const presignRes = await fetch("/api/sources/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
        signal: ac.signal,
      })
      if (!presignRes.ok) throw new Error("Presign fehlgeschlagen")
      const { presignedUrl, s3Key } = (await presignRes.json()) as {
        presignedUrl: string
        s3Key: string
      }

      await uploadWithProgress(file, presignedUrl, setProgress, ac.signal)

      const sourceRes = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, type: "pdf", title, s3Key, fileHash }),
        signal: ac.signal,
      })
      if (!sourceRes.ok) throw new Error("Quelle konnte nicht erstellt werden")
      const { sourceId } = (await sourceRes.json()) as { sourceId: string }
      currentSourceIdRef.current = sourceId
      setSourceCreated(true)

      await pollStatus(sourceId, setEmbedProgress, ac.signal)
      toast.success("Datei wurde hinzugefügt")
      reset()
      onOpenChange(false)
      window.location.reload()
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError"
      if (isAbort && minimizingRef.current) {
        // Minimized — sidebar takes over, don't clean up
        return
      }
      if (isAbort) {
        // User cancelled — clean up source if it was created
        if (currentSourceIdRef.current) {
          await deleteSource(currentSourceIdRef.current, notebookId).catch(() => undefined)
        }
        reset()
        return
      }
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen")
      reset()
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

  // ── Drive ────────────────────────────────────────────────────────────────────

  async function handleDrive() {
    try {
      const picked = await openDrivePicker()
      if (!picked) return
      setView("drive-downloading")
      const file = await downloadDriveFile(picked)
      setView("pick")
      await handleFile(file)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Drive-Fehler")
      setView("pick")
    }
  }

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

    currentTitleRef.current = parsed.hostname

    const ac = new AbortController()
    abortControllerRef.current = ac

    setView("url-processing")
    setEmbedProgress(0)

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, type: "url", url }),
        signal: ac.signal,
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string }
        throw new Error(error ?? "Unbekannter Fehler")
      }
      const { sourceId } = (await res.json()) as { sourceId: string }
      currentSourceIdRef.current = sourceId
      setSourceCreated(true)

      await pollStatus(sourceId, setEmbedProgress, ac.signal)
      toast.success("Webseite wurde hinzugefügt")
      reset()
      onOpenChange(false)
      window.location.reload()
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError"
      if (isAbort && minimizingRef.current) return
      if (isAbort) {
        if (currentSourceIdRef.current) {
          await deleteSource(currentSourceIdRef.current, notebookId).catch(() => undefined)
        }
        reset()
        setView("url-input")
        return
      }
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Fehler beim Hinzufügen")
      reset()
      setView("url-input")
    }
  }

  // ── Text ─────────────────────────────────────────────────────────────────────

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = pastedText.trim()
    if (!trimmed || trimmed.length > TEXT_MAX_CHARS) return

    const firstLine = trimmed.split("\n")[0].trim()
    const title = firstLine.length > 60 ? firstLine.slice(0, 60) : firstLine

    const ac = new AbortController()
    abortControllerRef.current = ac
    currentTitleRef.current = title

    setView("text-processing")
    setEmbedProgress(0)

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, type: "text", title, text: trimmed }),
        signal: ac.signal,
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string }
        throw new Error(error ?? "Unbekannter Fehler")
      }
      const { sourceId } = (await res.json()) as { sourceId: string }
      currentSourceIdRef.current = sourceId
      setSourceCreated(true)

      await pollStatus(sourceId, setEmbedProgress, ac.signal)
      toast.success("Text wurde hinzugefügt")
      reset()
      onOpenChange(false)
      window.location.reload()
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError"
      if (isAbort) {
        if (currentSourceIdRef.current) {
          await deleteSource(currentSourceIdRef.current, notebookId).catch(() => undefined)
        }
        reset()
        setView("text-input")
        return
      }
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Fehler beim Hinzufügen")
      reset()
      setView("text-input")
    }
  }

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : (o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-3xl p-6" showCloseButton={false}>
        <DialogHeader className="flex-row items-start justify-between">
          <DialogTitle className="text-xl font-semibold leading-snug">
            {view === "text-input" || view === "text-processing" ? (
              t("pastedTextTitle")
            ) : view === "url-input" || view === "url-processing" ? (
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
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 -mt-1"
            onClick={canMinimize ? handleMinimize : () => { reset(); onOpenChange(false) }}
            disabled={isUploading && !canMinimize}
            title={canMinimize ? "Minimieren" : "Schließen"}
          >
            <ChevronDown className="size-4" />
          </Button>
        </DialogHeader>

        {/* ── Picker ───────────────────────────────────────────────────────── */}
        {view === "pick" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                placeholder="Im Web nach neuen Quellen suchen"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                disabled
                onClick={() => devTodo("Web-Suche")}
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
                onClick={handleDrive}
              >
                <svg viewBox="0 0 87.3 78" className="size-5 shrink-0" aria-hidden>
                  <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0a7.3 7.3 0 003.3 6.65z" fill="#0066DA"/>
                  <path d="M43.65 25L29.9 1.2a8 8 0 00-3.3 3.3L.45 51.35A7.3 7.3 0 000 53.7h27.5z" fill="#00AC47"/>
                  <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25A7.3 7.3 0 0087.3 53.7H59.8l5.9 11.1z" fill="#EA4335"/>
                  <path d="M43.65 25L57.4 1.2A7.9 7.9 0 0053.65 0H33.65a7.9 7.9 0 00-3.75 1.2z" fill="#00832D"/>
                  <path d="M59.8 53.7H27.5L13.75 77.8c1.35.8 2.9 1.2 4.5 1.2h50.6c1.6 0 3.15-.4 4.5-1.2z" fill="#2684FC"/>
                  <path d="M73.4 26.45l-13.5-23.4c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28.7H87.3a7.3 7.3 0 00-.45-2.35z" fill="#FFBA00"/>
                </svg>
                <span className="text-xs leading-tight">Drive</span>
              </Button>
              <Button
                variant="outline"
                className="flex-col gap-1.5 h-auto py-4 whitespace-normal text-center"
                onClick={() => setView("text-input")}
              >
                <span className="text-xl leading-none shrink-0">📋</span>
                <span className="text-xs leading-tight">Kopierter Text</span>
              </Button>
            </div>

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
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {progress < 100
                    ? "Hochladen…"
                    : embedProgress > 0
                      ? "Einlesen & Indizieren…"
                      : "Verarbeiten…"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {progress < 100 ? `${progress}%` : embedProgress > 0 ? `${embedProgress}%` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    title="Abbrechen"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                {progress < 100 ? (
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                ) : embedProgress > 0 ? (
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${embedProgress}%` }}
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

        {/* ── Pasted text input ────────────────────────────────────────────── */}
        {view === "text-input" && (
          <form onSubmit={handleTextSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setView("pick")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Zurück
            </button>
            <p className="text-sm text-muted-foreground">{t("pastedTextDescription")}</p>
            <div className="space-y-1">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={t("pastedTextPlaceholder")}
                autoFocus
                className="min-h-48 w-full resize-y rounded-md border bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
              />
              <div className="flex items-center justify-between">
                {pastedText.length > TEXT_MAX_CHARS ? (
                  <span className="text-xs text-destructive">{t("pastedTextTooLong")}</span>
                ) : (
                  <span />
                )}
                <span className={`text-xs ${pastedText.length > TEXT_MAX_CHARS ? "text-destructive" : "text-muted-foreground"}`}>
                  {pastedText.length.toLocaleString()} / {TEXT_MAX_CHARS.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!pastedText.trim() || pastedText.length > TEXT_MAX_CHARS}>
                {t("insert")}
              </Button>
            </div>
          </form>
        )}

        {/* ── Text processing ───────────────────────────────────────────────── */}
        {view === "text-processing" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="size-10 animate-spin text-primary" />
            <div className="w-full space-y-2 text-center">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {embedProgress > 0 ? "Einlesen & Indizieren…" : "Text wird verarbeitet…"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {embedProgress > 0 ? `${embedProgress}%` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    title="Abbrechen"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                {embedProgress > 0 ? (
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${embedProgress}%` }}
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-primary" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Drive downloading ────────────────────────────────────────────── */}
        {view === "drive-downloading" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="size-10 animate-spin text-primary" />
            <div className="w-full space-y-2 text-center">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Datei wird aus Google Drive geladen…</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-full animate-pulse bg-primary" />
              </div>
            </div>
          </div>
        )}

        {/* ── URL processing ───────────────────────────────────────────────── */}
        {view === "url-processing" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="size-10 animate-spin text-primary" />
            <div className="w-full space-y-2 text-center">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {embedProgress > 0 ? "Einlesen & Indizieren…" : "Webseite wird verarbeitet…"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {embedProgress > 0 ? `${embedProgress}%` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    title="Abbrechen"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                {embedProgress > 0 ? (
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${embedProgress}%` }}
                  />
                ) : (
                  <div className="h-full w-full animate-pulse bg-primary" />
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
