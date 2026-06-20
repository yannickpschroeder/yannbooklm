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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { deleteSource, renameSource } from "@/lib/actions/sources"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Source } from "@/db/schema"

type ActiveUpload = {
  sourceId: string
  title: string
  embedPct: number
}

function SourceIcon({ type, status }: { type: Source["type"]; status: Source["status"] }) {
  if (status === "processing" || status === "pending") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
  }
  if (type === "youtube") return <FaYoutube className="size-4 shrink-0 text-red-500" />
  if (type === "url") return <Globe className="size-4 shrink-0 text-blue-400" />
  return <FileText className="size-4 shrink-0 text-red-400" />
}

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
  const processingSource = initialSources.find(
    (s) => s.status === "processing" || s.status === "pending"
  )
  const [activeUpload, setActiveUpload] = useState<ActiveUpload | null>(
    processingSource
      ? { sourceId: processingSource.id, title: processingSource.title, embedPct: processingSource.embedProgress }
      : null
  )

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
          collapsed ? "w-12" : "w-72"
        )}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b px-3">
          {!collapsed && <span className="text-sm font-medium">Quellen</span>}
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-7 shrink-0", collapsed && "mx-auto")}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>

        {!collapsed && (
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
              {/* Active upload item (minimized from modal) */}
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
                    <SourceIcon type={source.type} status={source.status} />
                    <span className="flex-1 truncate text-sm" title={source.title}>
                      {source.title}
                    </span>
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
