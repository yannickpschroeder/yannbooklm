"use client"

import { useState } from "react"
import { Plus, Search, PanelLeftClose, PanelLeftOpen, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const PLACEHOLDER_SOURCES = [
  { id: "1", name: "Beispiel-Dokument.pdf" },
  { id: "2", name: "Recherche-Notizen.pdf" },
  { id: "3", name: "Quellen-Übersicht.pdf" },
]

export function SourceSidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r bg-background transition-all duration-200",
        collapsed ? "w-12" : "w-72"
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-3">
        {!collapsed && (
          <span className="text-sm font-medium">Quellen</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-7 shrink-0", collapsed && "mx-auto")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-2 overflow-y-auto p-3">
          {/* Add source button */}
          <Button variant="outline" size="sm" className="w-full gap-2 justify-start">
            <Plus className="size-4" />
            Quellen hinzufügen
          </Button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Im Web nach Quellen suchen"
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Select all */}
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground">Alle auswählen</span>
          </div>

          {/* Source list (placeholder) */}
          <ul className="space-y-0.5">
            {PLACEHOLDER_SOURCES.map((source) => (
              <li
                key={source.id}
                className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
              >
                <FileText className="size-4 shrink-0 text-red-400" />
                <span className="flex-1 truncate text-sm">{source.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
