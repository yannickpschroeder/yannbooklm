"use client"

import { useState } from "react"
import { PanelRightClose, PanelRightOpen, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { devTodo } from "@/lib/dev-todo"
import {
  FaMicrophone,
  FaProjectDiagram,
  FaTable,
  FaQuestionCircle,
  FaSlideshare,
} from "react-icons/fa"

const STUDIO_TOOLS = [
  {
    id: "audio",
    label: "Audio-Zusammenfassung",
    icon: FaMicrophone,
    badge: null,
  },
  {
    id: "slidedeck",
    label: "Präsentation",
    icon: FaSlideshare,
    badge: "BETA",
  },
  {
    id: "mindmap",
    label: "Mindmap",
    icon: FaProjectDiagram,
    badge: null,
  },
  {
    id: "datatable",
    label: "Datentabelle",
    icon: FaTable,
    badge: null,
  },
  {
    id: "quiz",
    label: "Quiz",
    icon: FaQuestionCircle,
    badge: null,
  },
]

export function StudioSidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-l bg-background transition-all duration-200",
        collapsed ? "w-12" : "w-80"
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-3">
        {!collapsed && <span className="text-sm font-medium">Studio</span>}
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-7 shrink-0", collapsed && "mx-auto")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelRightOpen className="size-4" />
          ) : (
            <PanelRightClose className="size-4" />
          )}
        </Button>
      </div>

      {!collapsed && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Studio tools grid */}
          <div className="grid grid-cols-2 gap-2 p-3">
            {STUDIO_TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted"
                  onClick={() => devTodo(tool.label)}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-xs font-medium leading-tight">{tool.label}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {tool.badge && (
                      <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
                        {tool.badge}
                      </span>
                    )}
                    <ChevronRight className="size-3 text-muted-foreground" />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Note button */}
          <div className="border-t p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => devTodo("Notiz hinzufügen")}
            >
              <Plus className="size-4" />
              Notiz hinzufügen
            </Button>
          </div>
        </div>
      )}
    </aside>
  )
}
