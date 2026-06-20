"use client"

import { SlidersHorizontal, MoreHorizontal, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ChatPanel({ readySourceCount }: { readySourceCount: number }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <span className="text-sm font-medium">Chat</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7">
            <SlidersHorizontal className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {readySourceCount === 0
            ? "Füge Quellen hinzu um den Chat zu starten"
            : "Stelle eine Frage zu deinen Quellen"}
        </p>
        <p className="text-xs text-muted-foreground/60">
          Der Chat wird in einem zukünftigen Issue implementiert.
        </p>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t p-4">
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3">
          <input
            placeholder="Text eingeben..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            disabled
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {readySourceCount} {readySourceCount === 1 ? "Quelle" : "Quellen"}
            </span>
            <Button size="icon" className="size-7 rounded-full" disabled>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground/60">
          YannBookLM kann Fehler machen. Überprüfe wichtige Informationen.
        </p>
      </div>
    </div>
  )
}
