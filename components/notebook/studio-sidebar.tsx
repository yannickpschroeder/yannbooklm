"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import {
  PanelRightClose,
  PanelRightOpen,
  ChevronRight,
  Plus,
  ChevronLeft,
  MoreHorizontal,
  StickyNote,
} from "lucide-react"
import {
  FaMicrophone,
  FaProjectDiagram,
  FaTable,
  FaQuestionCircle,
  FaSlideshare,
} from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { devTodo } from "@/lib/dev-todo"
import { createNote, updateNote, deleteNote } from "@/lib/actions/notes"
import { toast } from "sonner"
import type { Note } from "@/db/schema"

const STUDIO_TOOLS = [
  { id: "audio", labelKey: "audio", icon: FaMicrophone, badge: null },
  { id: "slidedeck", labelKey: "slidedeck", icon: FaSlideshare, badge: "BETA" },
  { id: "mindmap", labelKey: "mindmap", icon: FaProjectDiagram, badge: null },
  { id: "datatable", labelKey: "datatable", icon: FaTable, badge: null },
  { id: "quiz", labelKey: "quiz", icon: FaQuestionCircle, badge: null },
] as const

// Listen for "save as note" events from ChatPanel
export const NOTE_FROM_CHAT_EVENT = "notebook:save-as-note"

export function StudioSidebar({
  notebookId,
  initialNotes,
}: {
  notebookId: string
  initialNotes: Note[]
}) {
  const t = useTranslations("notes")
  const tStudio = useTranslations("studio")
  const [collapsed, setCollapsed] = useState(false)
  const [notesList, setNotesList] = useState<Note[]>(initialNotes)
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [editContent, setEditContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Listen for "Als Notiz speichern" events from ChatPanel
  useEffect(() => {
    async function onSaveAsNote(e: Event) {
      const { content, sourceMessageId } = (e as CustomEvent<{ content: string; sourceMessageId?: string }>).detail
      const note = await createNote(notebookId, content, sourceMessageId)
      if (!note) return
      setNotesList((prev) => [note, ...prev])
      toast.success(t("createSuccess"))
      if (collapsed) setCollapsed(false)
    }
    window.addEventListener(NOTE_FROM_CHAT_EVENT, onSaveAsNote)
    return () => window.removeEventListener(NOTE_FROM_CHAT_EVENT, onSaveAsNote)
  }, [notebookId, collapsed, t])

  // Auto-focus textarea when entering note detail view
  useEffect(() => {
    if (activeNote) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [activeNote?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleNewNote() {
    const note = await createNote(notebookId, "")
    if (!note) return
    setNotesList((prev) => [note, ...prev])
    openNoteDetail(note)
  }

  function openNoteDetail(note: Note) {
    setActiveNote(note)
    setEditContent(note.content)
    setCollapsed(false)
  }

  async function handleSaveNote() {
    if (!activeNote) return
    setIsSaving(true)
    try {
      await updateNote(activeNote.id, notebookId, editContent)
      setNotesList((prev) =>
        prev.map((n) => (n.id === activeNote.id ? { ...n, content: editContent } : n))
      )
      setActiveNote((prev) => (prev ? { ...prev, content: editContent } : null))
      toast.success(t("saveSuccess"))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteNote(noteId: string) {
    setNotesList((prev) => prev.filter((n) => n.id !== noteId))
    if (activeNote?.id === noteId) setActiveNote(null)
    await deleteNote(noteId, notebookId)
    toast.success(t("deleteSuccess"))
  }

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-l bg-background transition-all duration-200",
        collapsed ? "w-12" : "w-96"
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-3">
        {!collapsed && (
          <span className="text-sm font-medium">
            {activeNote ? t("title") : "Studio"}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-7 shrink-0", collapsed && "mx-auto")}
          onClick={() => {
            if (collapsed) setCollapsed(false)
            else { setCollapsed(true); setActiveNote(null) }
          }}
        >
          {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
        </Button>
      </div>

      {!collapsed && (
        activeNote ? (
          /* ── Note detail view ── */
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => setActiveNote(null)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              {activeNote.sourceMessageId && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {t("fromChat")}
                </span>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder={t("placeholder")}
              className="flex-1 resize-none bg-transparent p-4 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="shrink-0 border-t p-3">
              <Button
                size="sm"
                className="w-full"
                onClick={handleSaveNote}
                disabled={isSaving}
              >
                {t("save")}
              </Button>
            </div>
          </div>
        ) : (
          /* ── List view ── */
          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Studio tools grid */}
            <div className="grid grid-cols-2 gap-2 p-3">
              {STUDIO_TOOLS.map((tool) => {
                const Icon = tool.icon
                return (
                  <button
                    key={tool.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted"
                    onClick={() => devTodo(tool.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="text-xs font-medium leading-tight">
                        {tStudio(tool.labelKey)}
                      </span>
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

            <Separator />

            {/* Notes section */}
            <div className="flex flex-col gap-1 p-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-medium text-muted-foreground">{t("title")}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={handleNewNote}
                  title={t("newNote")}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>

              {notesList.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">{t("noNotes")}</p>
              ) : (
                <ul className="space-y-0.5">
                  {notesList.map((note) => (
                    <li key={note.id} className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted">
                      <StickyNote className="size-4 shrink-0 text-muted-foreground" />
                      <button
                        className="min-w-0 flex-1 truncate text-left text-sm"
                        onClick={() => openNoteDetail(note)}
                      >
                        {note.content.trim() || <span className="text-muted-foreground italic">{t("placeholder")}</span>}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted-foreground/20 group-hover:opacity-100 focus:opacity-100">
                          <MoreHorizontal className="size-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => devTodo("setAsSource")}>
                            {t("setAsSource")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => devTodo("setAllAsSource")}>
                            {t("setAllAsSource")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => devTodo("exportToDocs")}>
                            {t("exportToDocs")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => devTodo("exportToSheets")}>
                            {t("exportToSheets")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            {t("deleteNote")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      )}
    </aside>
  )
}
