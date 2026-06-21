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
  StickyNote,
  X,
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
import { deleteSource, renameSource, toggleSourceEnabled } from "@/lib/actions/sources"
import { onSourceView, openSourceView, onOpenSourceById } from "@/lib/source-view-event"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { SourceDetailPanel } from "@/components/notebook/source-detail-panel"
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
  if (type === "text") return <StickyNote className="size-4 shrink-0 text-blue-400" />
  return <FileText className="size-4 shrink-0 text-red-400" />
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
  const tCommon = useTranslations("common")
  const [activeChunk, setActiveChunk] = useState<CitationChunk | null>(null)
  const [loadingSourceId, setLoadingSourceId] = useState<string | null>(null)
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialSources.map((s) => [s.id, s.enabled]))
  )

  const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>(() =>
    initialSources
      .filter((s) => s.status === "processing" || s.status === "pending")
      .map((s) => ({ sourceId: s.id, title: s.title, embedPct: s.embedProgress }))
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

  const handleSourceClickRef = useRef<(source: Source) => Promise<void>>(async () => undefined)

  useEffect(() => {
    return onOpenSourceById((sourceId) => {
      const source = initialSources.find((s) => s.id === sourceId)
      if (source) handleSourceClickRef.current(source)
    })
  }, [initialSources])

  // One poller per active upload — restarts when the set of sourceIds changes
  const activeUploadIds = activeUploads.map((u) => u.sourceId).join(",")
  useEffect(() => {
    if (activeUploads.length === 0) return
    const controllers = activeUploads.map((upload) => {
      const ctrl = { cancelled: false }
      const { sourceId } = upload
      ;(async () => {
        for (let i = 0; i < 300; i++) {
          if (ctrl.cancelled) return
          await new Promise((r) => setTimeout(r, 2000))
          if (ctrl.cancelled) return
          try {
            const res = await fetch(`/api/sources/${sourceId}/status`)
            if (res.status === 404 || !res.ok) {
              if (!ctrl.cancelled) {
                setActiveUploads((prev) => prev.filter((u) => u.sourceId !== sourceId))
                toast.error(t("processingFailed"))
              }
              return
            }
            const { status, embedProgress } = (await res.json()) as { status: string; embedProgress: number }
            if (!ctrl.cancelled)
              setActiveUploads((prev) => prev.map((u) => u.sourceId === sourceId ? { ...u, embedPct: embedProgress } : u))
            if (status === "ready") {
              if (!ctrl.cancelled) {
                setActiveUploads((prev) => prev.filter((u) => u.sourceId !== sourceId))
                window.location.reload()
              }
              return
            }
            if (status === "error") {
              if (!ctrl.cancelled) {
                setActiveUploads((prev) => prev.filter((u) => u.sourceId !== sourceId))
                toast.error(t("processingFailed"))
              }
              return
            }
          } catch {
            // network hiccup — continue polling
          }
        }
        if (!ctrl.cancelled) {
          setActiveUploads((prev) => prev.filter((u) => u.sourceId !== sourceId))
          toast.error(t("processingTimeout"))
        }
      })()
      return ctrl
    })
    return () => { controllers.forEach((c) => { c.cancelled = true }) }
  }, [activeUploadIds]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleMinimize(sourceId: string, title: string) {
    setActiveUploads((prev) =>
      prev.find((u) => u.sourceId === sourceId) ? prev : [...prev, { sourceId, title, embedPct: 0 }]
    )
    setModalOpen(false)
  }

  function handleCancelUpload(sourceId: string) {
    setActiveUploads((prev) => prev.filter((u) => u.sourceId !== sourceId))
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
      toast.success(t("renameSuccess"))
      window.location.reload()
    })
  }

  function handleDelete(source: Source) {
    startTransition(async () => {
      await deleteSource(source.id, notebookId)
      toast.success(t("removeSuccess"))
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
      toast.error(t("previewError"))
    } finally {
      setLoadingSourceId(null)
    }
  }
  useEffect(() => { handleSourceClickRef.current = handleSourceClick })

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
        {/* Header */}
        <div className={cn("flex h-12 shrink-0 items-center border-b", collapsed ? "justify-center px-0" : "justify-between px-3")}>
          {!collapsed && <span className="text-sm font-medium">{t("title")}</span>}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>

        {collapsed ? (
          /* Collapsed icon strip */
          <div className="flex flex-col items-center gap-1 overflow-y-auto py-2">
            <button
              title={t("addSource")}
              onClick={() => setModalOpen(true)}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Plus className="size-4" />
            </button>
            {initialSources.length > 0 && <Separator className="my-1 w-6" />}
            {initialSources.map((source) => (
              <button
                key={source.id}
                title={source.title}
                onClick={() => handleSourceClick(source)}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <SourceTypeIcon type={source.type} status={source.status} />
              </button>
            ))}
          </div>
        ) : activeChunk ? (
          /* Source detail view */
          <SourceDetailPanel
            chunk={activeChunk}
            onClose={() => setActiveChunk(null)}
            onTopicClick={(topic) =>
              window.dispatchEvent(new CustomEvent("notebook:set-input", { detail: { text: topic } }))
            }
          />
        ) : (
          /* Normal sources list */
          <>
            <div className="flex flex-col gap-2 overflow-y-auto p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setModalOpen(true)}
              >
                <Plus className="size-4" />
                {t("addSources")}
              </Button>

              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-3.5" />
                <Input
                  placeholder={t("searchPlaceholder")}
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
                {activeUploads.map((upload) => (
                  <li key={upload.sourceId} className="bg-muted/50 flex items-center gap-2 rounded-md px-2 py-2">
                    <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm" title={upload.title}>
                        {upload.title}
                      </span>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="bg-muted h-1 flex-1 overflow-hidden rounded-full">
                          {upload.embedPct > 0 ? (
                            <div
                              className="bg-primary h-full transition-all duration-500"
                              style={{ width: `${upload.embedPct}%` }}
                            />
                          ) : (
                            <div className="bg-primary h-full w-1/3 animate-pulse" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCancelUpload(upload.sourceId)}
                          className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5"
                          title={tCommon("cancel")}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}

                {filtered.length === 0 && activeUploads.length === 0 ? (
                  <li>
                    <p className="text-muted-foreground py-6 text-center text-xs">
                      {initialSources.length === 0
                        ? t("noSourcesAvailable")
                        : t("noResults")}
                    </p>
                  </li>
                ) : (
                  filtered.map((source) => (
                    <li
                      key={source.id}
                      id={`source-${source.id}`}
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
                          aria-label={t("optionsMenu")}
                        >
                          <MoreHorizontal className="text-muted-foreground size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-max">
                          <DropdownMenuItem className="whitespace-nowrap" onClick={() => handleRenameOpen(source)}>
                            <Pencil className="mr-2 size-4" />
                            {t("rename")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="whitespace-nowrap text-destructive focus:text-destructive"
                            onClick={() => handleDelete(source)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            {t("remove")}
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
            <DialogTitle>{t("renameDialogTitle")}</DialogTitle>
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
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending || !renameValue.trim()}>
                {tCommon("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
