"use client"

import { useState, useTransition } from "react"
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
import { deleteSource, renameSource } from "@/lib/actions/sources"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Source } from "@/db/schema"

function SourceIcon({ type, status }: { type: Source["type"]; status: Source["status"] }) {
  if (status === "processing" || status === "pending") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
  }
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

  const filtered = initialSources.filter((s) =>
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
            {/* Add source button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => setModalOpen(true)}
            >
              <Plus className="size-4" />
              Quellen hinzufügen
            </Button>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Quellen durchsuchen"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Source list */}
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {initialSources.length === 0
                  ? "Noch keine Quellen vorhanden"
                  : "Keine Treffer"}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((source) => (
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
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>

      <AddSourceModal
        notebookId={notebookId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        sourceCount={initialSources.length}
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
