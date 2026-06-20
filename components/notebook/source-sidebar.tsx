"use client"

import { useTranslations } from "next-intl"
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
  ChevronDown,
  ChevronUp,
  Sparkles,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AddSourceModal } from "@/components/sources/add-source-modal"
import { FaYoutube } from "react-icons/fa"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { deleteSource, renameSource, toggleSourceEnabled } from "@/lib/actions/sources"
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
    return <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
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
      return {
        href: `https://www.youtube.com/watch?v=${id}&t=${chunk.positionStart}`,
        label: `${m}:${s}`,
      }
    }
  }
  if (chunk.sourceType === "pdf" && chunk.pageNumber != null) {
    return { href: null, label: `Seite ${chunk.pageNumber}` }
  }
  if (chunk.url) {
    try {
      return { href: chunk.url, label: new URL(chunk.url).hostname }
    } catch {
      /* noop */
    }
  }
  return null
}

// ─── Source detail panel ───────────────────────────────────────────────────────

function SourceDetailPanel({ chunk, onClose }: { chunk: CitationChunk; onClose: () => void }) {
  const link = buildSourceLink(chunk)
  const [summaryOpen, setSummaryOpen] = useState(false)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onClose}
          title="Zurück zu Quellen"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <CitationSourceIcon type={chunk.sourceType} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={chunk.sourceTitle}>
          {chunk.sourceTitle}
        </span>
      </div>

      <Separator />

      {/* Quellenübersicht — card dropdown, fixed above scrollable content */}
      {chunk.sourceSummary && (
        <div className="my-2 shrink-0 px-3 py-2">
          <div className="overflow-hidden rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
            <button
              onClick={() => setSummaryOpen((p) => !p)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-violet-500/10"
            >
              <Sparkles className="size-3.5 shrink-0 text-violet-400" />
              <span className="flex-1 font-medium text-violet-100">Quellenübersicht</span>
              {summaryOpen ? (
                <ChevronUp className="size-3.5 shrink-0 text-violet-400" />
              ) : (
                <ChevronDown className="size-3.5 shrink-0 text-violet-400" />
              )}
            </button>
            {summaryOpen && (
              <div className="text-foreground max-h-64 overflow-y-auto border-t border-violet-500/20 p-5 text-sm leading-relaxed">
                <Markdown remarkPlugins={[remarkGfm]}>{chunk.sourceSummary}</Markdown>
                {chunk.sourceTopics && chunk.sourceTopics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {chunk.sourceTopics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("notebook:ask", { detail: { text: topic } })
                          )
                        }
                        className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 text-xs text-violet-300 hover:bg-violet-500/25"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content — scrollable, Markdown */}
      <div className="text-foreground flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            p(props) {
              const { node: _node, children, ...rest } = props
              return (
                <p className="mb-3 last:mb-0" {...rest}>
                  {children}
                </p>
              )
            },
            img(props) {
              const { node: _node, src, alt, ...rest } = props
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={typeof src === "string" ? src : undefined}
                  alt={alt ?? ""}
                  className="my-3 w-full rounded-md object-cover"
                  {...rest}
                />
              )
            },
            ul(props) {
              const { node: _node, children, ...rest } = props
              return (
                <ul className="mb-3 list-disc space-y-1 pl-4 last:mb-0" {...rest}>
                  {children}
                </ul>
              )
            },
            ol(props) {
              const { node: _node, children, ...rest } = props
              return (
                <ol className="mb-3 list-decimal space-y-1 pl-4 last:mb-0" {...rest}>
                  {children}
                </ol>
              )
            },
            li(props) {
              const { node: _node, children, ...rest } = props
              return <li {...rest}>{children}</li>
            },
            strong(props) {
              const { node: _node, children, ...rest } = props
              return (
                <strong className="font-semibold" {...rest}>
                  {children}
                </strong>
              )
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
            className="text-primary flex items-center gap-1.5 text-xs hover:underline"
          >
            <ExternalLink className="size-3" />
            Quelle anzeigen
          </a>
        ) : link ? (
          <span className="text-muted-foreground text-xs">{link.label}</span>
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
  const t = useTranslations("sources")
  const [activeChunk, setActiveChunk] = useState<CitationChunk | null>(null)
  const [loadingSourceId, setLoadingSourceId] = useState<string | null>(null)
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialSources.map((s) => [s.id, s.enabled]))
  )

  const processingSource = initialSources.find(
    (s) => s.status === "processing" || s.status === "pending"
  )
  const [activeUpload, setActiveUpload] = useState<ActiveUpload | null>(
    processingSource
      ? {
          sourceId: processingSource.id,
          title: processingSource.title,
          embedPct: processingSource.embedProgress,
        }
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
            if (!cancelled) {
              setActiveUpload(null)
              toast.error("Verarbeitung fehlgeschlagen")
            }
            return
          }
          const { status, embedProgress } = (await res.json()) as {
            status: string
            embedProgress: number
          }
          if (!cancelled)
            setActiveUpload((prev) => (prev ? { ...prev, embedPct: embedProgress } : null))
          if (status === "ready") {
            if (!cancelled) {
              setActiveUpload(null)
              window.location.reload()
            }
            return
          }
          if (status === "error") {
            if (!cancelled) {
              setActiveUpload(null)
              toast.error("Verarbeitung fehlgeschlagen")
            }
            return
          }
        } catch {
          // network hiccup — continue polling
        }
      }
      if (!cancelled) {
        setActiveUpload(null)
        toast.error("Timeout beim Verarbeiten")
      }
    }

    poll()
    return () => {
      cancelled = true
    }
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

  function emitSourceCount(newEnabledMap: Record<string, boolean>) {
    const count = initialSources.filter(
      (s) => s.status === "ready" && (newEnabledMap[s.id] ?? true)
    ).length
    window.dispatchEvent(new CustomEvent("notebook:source-count-change", { detail: { count } }))
  }

  function handleToggleEnabled(source: Source) {
    const next = !(enabledMap[source.id] ?? true)
    const newMap = { ...enabledMap, [source.id]: next }
    setEnabledMap(newMap)
    emitSourceCount(newMap)
    toggleSourceEnabled(source.id, notebookId, next).catch(() => {
      const revertedMap = { ...newMap, [source.id]: !next }
      setEnabledMap(revertedMap)
      emitSourceCount(revertedMap)
      toast.error(t("toggleError"))
    })
  }

  function handleToggleAll(readySources: Source[]) {
    const allEnabled = readySources.every((s) => enabledMap[s.id] ?? true)
    const next = !allEnabled
    const newMap = {
      ...enabledMap,
      ...Object.fromEntries(readySources.map((s) => [s.id, next])),
    }
    setEnabledMap(newMap)
    emitSourceCount(newMap)
    Promise.all(
      readySources.map((s) => toggleSourceEnabled(s.id, notebookId, next).catch(() => undefined))
    ).catch(() => toast.error(t("toggleError")))
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
          "bg-background flex shrink-0 flex-col border-r transition-all duration-200",
          collapsed ? "w-12" : "w-96"
        )}
      >
        {/* Collapsed state: just the toggle button */}
        {collapsed ? (
          <div className="flex h-12 items-center justify-center border-b">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setCollapsed(false)}
            >
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
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => setCollapsed(true)}
              >
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
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
                <Input
                  placeholder="Quellen durchsuchen"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {filtered.length > 0 &&
                (() => {
                  const readySources = filtered.filter((s) => s.status === "ready")
                  const allEnabled =
                    readySources.length > 0 && readySources.every((s) => enabledMap[s.id] ?? true)
                  return (
                    <div className="flex items-center justify-end gap-2 px-2 py-1">
                      <span className="text-muted-foreground text-xs">{t("selectAll")}</span>
                      <input
                        type="checkbox"
                        checked={allEnabled}
                        onChange={() => handleToggleAll(readySources)}
                        className="accent-primary size-3.5 cursor-pointer"
                      />
                    </div>
                  )
                })()}

              <ul className="space-y-0.5">
                {activeUpload && (
                  <li className="bg-muted/50 flex items-center gap-2 rounded-md px-2 py-2">
                    <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm" title={activeUpload.title}>
                        {activeUpload.title}
                      </span>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="bg-muted h-1 flex-1 overflow-hidden rounded-full">
                          {activeUpload.embedPct > 0 ? (
                            <div
                              className="bg-primary h-full transition-all duration-500"
                              style={{ width: `${activeUpload.embedPct}%` }}
                            />
                          ) : (
                            <div className="bg-primary h-full w-1/3 animate-pulse" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleCancelActiveUpload}
                          className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5"
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
                    <p className="text-muted-foreground py-6 text-center text-xs">
                      {initialSources.length === 0
                        ? "Noch keine Quellen vorhanden"
                        : "Keine Treffer"}
                    </p>
                  </li>
                ) : (
                  filtered.map((source) => (
                    <li
                      key={source.id}
                      className={cn(
                        "group hover:bg-muted flex items-center gap-2 rounded-md px-2 py-2",
                        !(enabledMap[source.id] ?? true) && "opacity-50"
                      )}
                    >
                      {loadingSourceId === source.id ? (
                        <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
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
                          className="hover:bg-muted-foreground/20 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                          aria-label="Optionen"
                        >
                          <MoreHorizontal className="text-muted-foreground size-4" />
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
                      <input
                        type="checkbox"
                        checked={enabledMap[source.id] ?? true}
                        onChange={() => handleToggleEnabled(source)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={source.status !== "ready"}
                        className="accent-primary size-3.5 shrink-0 cursor-pointer disabled:cursor-default"
                        title={
                          (enabledMap[source.id] ?? true) ? t("disableSource") : t("enableSource")
                        }
                      />
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
