"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import {
  Plus,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  FileText,
  Globe,
  Loader2,
  MoreHorizontal,
  Trash2,
  Pencil,
  X,
  ExternalLink,
  ChevronLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AddSourceModal } from "@/components/sources/add-source-modal"
import { FaYoutube } from "react-icons/fa"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { deleteSource, renameSource } from "@/lib/actions/sources"
import { onSourceView, openSourceView } from "@/lib/source-view-event"
import { resolveS3ImagesInContent } from "@/lib/s3-image-url"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Source } from "@/db/schema"
import type { CitationChunk } from "@/lib/types/chat"

type ActiveUpload = {
  sourceId: string
  title: string
  embedPct: number
}

function SourceTypeIcon({ type, status }: { type: Source["type"]; status: Source["status"] }) {
  if (status === "processing" || status === "pending") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
  }
  if (type === "youtube") return <FaYoutube className="size-4 shrink-0 text-red-500" />
  if (type === "url") return <Globe className="size-4 shrink-0 text-blue-400" />
  return <FileText className="size-4 shrink-0 text-red-400" />
}

function CitationSourceIcon({ type }: { type: string }) {
  if (type === "youtube") return <FaYoutube className="size-4 shrink-0 text-red-500" />
  if (type === "url") return <Globe className="size-4 shrink-0 text-blue-400" />
  return <FileText className="size-4 shrink-0 text-red-400" />
}

function buildSourceLink(chunk: CitationChunk) {
  if (chunk.sourceType === "youtube" && chunk.url && chunk.positionStart != null) {
    const id = chunk.url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([\w-]{11})/)?.[1]
    if (id) {
      const m = Math.floor(chunk.positionStart / 60)
      const s = String(chunk.positionStart % 60).padStart(2, "0")
      return { href: `https://www.youtube.com/watch?v=${id}&t=${chunk.positionStart}`, label: `${m}:${s}` }
    }
  }
  if (chunk.sourceType === "pdf" && chunk.pageNumber != null) {
    return { href: null, label: `Seite ${chunk.pageNumber}` }
  }
  if (chunk.url) {
    try { return { href: chunk.url, label: new URL(chunk.url).hostname } } catch { /* noop */ }
  }
  return null
}

// ─── Source detail panel ───────────────────────────────────────────────────────

function SourceDetailPanel({
  chunk,
  onClose,
}: {
  chunk: CitationChunk
  onClose: () => void
}) {
  const link = buildSourceLink(chunk)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose} title="Zurück zu Quellen">
          <ChevronLeft className="size-4" />
        </Button>
        <CitationSourceIcon type={chunk.sourceType} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={chunk.sourceTitle}>
          {chunk.sourceTitle}
        </span>
      </div>

      <Separator />

      {/* Content — scrollable, Markdown */}
      <div className="flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-foreground">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            p(props) {
              const { node: _node, children, ...rest } = props
              return <p className="mb-3 last:mb-0" {...rest}>{children}</p>
            },
            img(props) {
              const { node: _node, src, alt, ...rest } = props
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} className="my-3 w-full rounded-md object-cover" {...rest} />
              )
            },
            ul(props) {
              const { node: _node, children, ...rest } = props
              return <ul className="mb-3 list-disc space-y-1 pl-4 last:mb-0" {...rest}>{children}</ul>
            },
            ol(props) {
              const { node: _node, children, ...rest } = props
              return <ol className="mb-3 list-decimal space-y-1 pl-4 last:mb-0" {...rest}>{children}</ol>
            },
            li(props) {
              const { node: _node, children, ...rest } = props
              return <li {...rest}>{children}</li>
            },
            strong(props) {
              const { node: _node, children, ...rest } = props
              return <strong className="font-semibold" {...rest}>{children}</strong>
            },
          }}
        >
          {resolveS3ImagesInContent(chunk.content)}
        </Markdown>
      </div>

      <Separator />

      {/* Footer: Quelle anzeigen */}
      <div className="shrink-0 px-4 py-3">
        {link?.href ? (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="size-3" />
            Quelle anzeigen
          </a>
        ) : link ? (
          <span className="text-xs text-muted-foreground">{link.label}</span>
        ) : null}
      </div>
    </div>
  )
}

// ─── Main SourceSidebar ────────────────────────────────────────────────────────

export function SourceSidebar({
  notebookId,
  initialSources,
}: {
  notebookId: string
  initialSources: Source[]
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(initialSources.length === 0)
  const [renameTarget, setRenameTarget] = useState<Source | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [isPending, startTransition] = useTransition()
  const [activeChunk, setActiveChunk] = useState<CitationChunk | null>(null)
  const [loadingSourceId, setLoadingSourceId] = useState<string | null>(null)

  const processingSource = initialSources.find(
    (s) => s.status === "processing" || s.status === "pending"
  )
  const [activeUpload, setActiveUpload] = useState<ActiveUpload | null>(
    processingSource
      ? { sourceId: processingSource.id, title: processingSource.title, embedPct: processingSource.embedProgress }
      : null
  )

  // Listen for source-view events from ChatPanel
  useEffect(() => {
    return onSourceView((chunk) => {
      if (chunk) {
        setCollapsed(false)
        setActiveChunk(chunk)
      } else {
        setActiveChunk(null)
      }
    })
  }, [])

  // Poll while an upload is minimized to sidebar
  const activeSourceIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeUpload) return
    activeSourceIdRef.current = activeUpload.sourceId

    let cancelled = false
    async function poll() {
      for (let i = 0; i < 300; i++) {
        if (cancelled) return
        await new Promise((r) => setTimeout(r, 2000))
        if (cancelled) return
        try {
          const res = await fetch(`/api/sources/${activeSourceIdRef.current}/status`)
          if (res.status === 404 || !res.ok) {
            if (!cancelled) { setActiveUpload(null); toast.error("Verarbeitung fehlgeschlagen") }
            return
          }
          const { status, embedProgress } = (await res.json()) as { status: string; embedProgress: number }
          if (!cancelled) setActiveUpload((prev) => prev ? { ...prev, embedPct: embedProgress } : null)
          if (status === "ready") {
            if (!cancelled) { setActiveUpload(null); window.location.reload() }
            return
          }
          if (status === "error") {
            if (!cancelled) { setActiveUpload(null); toast.error("Verarbeitung fehlgeschlagen") }
            return
          }
        } catch {
          // network hiccup — continue polling
        }
      }
      if (!cancelled) { setActiveUpload(null); toast.error("Timeout beim Verarbeiten") }
    }

    poll()
    return () => { cancelled = true }
  }, [activeUpload?.sourceId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleMinimize(sourceId: string, title: string) {
    setActiveUpload({ sourceId, title, embedPct: 0 })
    setModalOpen(false)
  }

  function handleCancelActiveUpload() {
    if (!activeUpload) return
    const { sourceId } = activeUpload
    setActiveUpload(null)
    deleteSource(sourceId, notebookId).catch(() => undefined)
  }

  function handleRenameOpen(source: Source) {
    setRenameTarget(source)
    setRenameValue(source.title)
  }

  function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!renameTarget || !renameValue.trim()) return
    startTransition(async () => {
      await renameSource(renameTarget.id, notebookId, renameValue.trim())
      setRenameTarget(null)
      toast.success("Quelle umbenannt")
      window.location.reload()
    })
  }

  function handleDelete(source: Source) {
    startTransition(async () => {
      await deleteSource(source.id, notebookId)
      toast.success("Quelle entfernt")
      window.location.reload()
    })
  }

  async function handleSourceClick(source: Source) {
    if (source.status !== "ready") return
    setLoadingSourceId(source.id)
    try {
      const res = await fetch(`/api/sources/${source.id}/preview`)
      if (!res.ok) throw new Error()
      const chunk = (await res.json()) as CitationChunk
      setCollapsed(false)
      setActiveChunk(chunk)
      openSourceView(chunk)
    } catch {
      toast.error("Vorschau konnte nicht geladen werden")
    } finally {
      setLoadingSourceId(null)
    }
  }

  const filtered = initialSources.filter(
    (s) =>
      s.status !== "processing" &&
      s.status !== "pending" &&
      s.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r bg-background transition-all duration-200",
          collapsed ? "w-12" : "w-96"
        )}
      >
        {/* Collapsed state: just the toggle button */}
        {collapsed ? (
          <div className="flex h-12 items-center justify-center border-b">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setCollapsed(false)}>
              <PanelLeftOpen className="size-4" />
            </Button>
          </div>
        ) : activeChunk ? (
          /* Source detail view */
          <SourceDetailPanel chunk={activeChunk} onClose={() => setActiveChunk(null)} />
        ) : (
          /* Normal sources list */
          <>
            <div className="flex h-12 items-center justify-between border-b px-3">
              <span className="text-sm font-medium">Quellen</span>
              <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => setCollapsed(true)}>
                <PanelLeftClose className="size-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setModalOpen(true)}
              >
                <Plus className="size-4" />
                Quellen hinzufügen
              </Button>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Quellen durchsuchen"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <ul className="space-y-0.5">
                {activeUpload && (
                  <li className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-2">
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm" title={activeUpload.title}>
                        {activeUpload.title}
                      </span>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                          {activeUpload.embedPct > 0 ? (
                            <div
                              className="h-full bg-primary transition-all duration-500"
                              style={{ width: `${activeUpload.embedPct}%` }}
                            />
                          ) : (
                            <div className="h-full w-1/3 animate-pulse bg-primary" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleCancelActiveUpload}
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                          title="Abbrechen"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                )}

                {filtered.length === 0 && !activeUpload ? (
                  <li>
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      {initialSources.length === 0
                        ? "Noch keine Quellen vorhanden"
                        : "Keine Treffer"}
                    </p>
                  </li>
                ) : (
                  filtered.map((source) => (
                    <li
                      key={source.id}
                      className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted"
                    >
                      {loadingSourceId === source.id ? (
                        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <SourceTypeIcon type={source.type} status={source.status} />
                      )}
                      <button
                        className="min-w-0 flex-1 truncate text-left text-sm disabled:cursor-default disabled:opacity-50"
                        title={source.title}
                        disabled={source.status !== "ready" || loadingSourceId !== null}
                        onClick={() => handleSourceClick(source)}
                      >
                        {source.title}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted-foreground/20 group-hover:opacity-100 focus:opacity-100"
                          aria-label="Optionen"
                        >
                          <MoreHorizontal className="size-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRenameOpen(source)}>
                            <Pencil className="mr-2 size-4" />
                            Quelle umbenennen
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(source)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Quelle entfernen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </>
        )}
      </aside>

      <AddSourceModal
        notebookId={notebookId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        sourceCount={initialSources.length}
        onMinimize={handleMinimize}
      />

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Quelle umbenennen</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              required
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isPending || !renameValue.trim()}>
                Speichern
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
