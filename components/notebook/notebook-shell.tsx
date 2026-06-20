"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { StudioSidebar } from "./studio-sidebar"
import type { Note, StudioOutput } from "@/db/schema"

export function NotebookShell({
  children,
  notebookId,
  initialNotes,
  initialStudioOutputs,
}: {
  children: React.ReactNode
  notebookId: string
  initialNotes: Note[]
  initialStudioOutputs: StudioOutput[]
}) {
  const [noteMode, setNoteMode] = useState(false)

  return (
    <>
      <main className={cn("flex overflow-hidden transition-all duration-200", noteMode ? "w-0" : "flex-1")}>
        {children}
      </main>
      <StudioSidebar
        notebookId={notebookId}
        initialNotes={initialNotes}
        initialStudioOutputs={initialStudioOutputs}
        noteMode={noteMode}
        onNoteModeChange={setNoteMode}
      />
    </>
  )
}
