"use client"

import { useState } from "react"
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
      <main className="flex flex-1 overflow-hidden">
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
