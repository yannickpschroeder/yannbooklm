"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations, useLocale } from "next-intl"
import {
  PanelRightClose,
  PanelRightOpen,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  StickyNote,
  Trash2,
  BookmarkPlus,
  Library,
  FileText,
  Table2,
  Share2,
  Pencil,
  History,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { devTodo } from "@/lib/dev-todo"
import { createNote, updateNote, deleteNote } from "@/lib/actions/notes"
import { exportNoteToGoogleDocs, exportNoteToGoogleSheets } from "@/lib/google-docs-export"
import { NoteEditor } from "./note-editor"
import { QuizView } from "./quiz-view"
import type { QuizData } from "./quiz-view"
import { toast } from "sonner"
import type { Note, StudioOutput } from "@/db/schema"

const STUDIO_TOOLS = [
  { id: "audio", labelKey: "audio", icon: FaMicrophone, badge: null },
  { id: "slidedeck", labelKey: "slidedeck", icon: FaSlideshare, badge: "BETA" },
  { id: "mindmap", labelKey: "mindmap", icon: FaProjectDiagram, badge: null },
  { id: "datatable", labelKey: "datatable", icon: FaTable, badge: null },
  { id: "quiz", labelKey: "quiz", icon: FaQuestionCircle, badge: null },
] as const

export const NOTE_FROM_CHAT_EVENT = "notebook:save-as-note"

type OutputKind = "note" | StudioOutput["type"]

type OutputItem = {
  id: string
  kind: OutputKind
  title: string
  createdAt: Date
  note?: Note
}

function outputIcon(kind: OutputKind) {
  switch (kind) {
    case "audio":     return <FaMicrophone className="size-4 shrink-0 text-muted-foreground" />
    case "mindmap":   return <FaProjectDiagram className="size-4 shrink-0 text-muted-foreground" />
    case "slidedeck": return <FaSlideshare className="size-4 shrink-0 text-muted-foreground" />
    case "datatable": return <FaTable className="size-4 shrink-0 text-muted-foreground" />
    case "quiz":      return <FaQuestionCircle className="size-4 shrink-0 text-muted-foreground" />
    default:          return <StickyNote className="size-4 shrink-0 text-blue-400" />
  }
}

function relativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return "Gerade eben"
  if (diff < 3600) return `Vor ${Math.floor(diff / 60)} Min.`
  if (diff < 86400) return `Vor ${Math.floor(diff / 3600)} Std.`
  return `Vor ${Math.floor(diff / 86400)} Tag${Math.floor(diff / 86400) === 1 ? "" : "en"}`
}

function noteToOutputItem(note: Note): OutputItem {
  return { id: note.id, kind: "note", title: note.title, createdAt: note.createdAt, note }
}

function studioOutputToItem(o: StudioOutput, tStudio: (k: string) => string): OutputItem {
  return { id: o.id, kind: o.type, title: o.title ?? tStudio(o.type), createdAt: o.createdAt }
}

export function StudioSidebar({
  notebookId,
  initialNotes,
  initialStudioOutputs,
  noteMode,
  onNoteModeChange,
}: {
  notebookId: string
  initialNotes: Note[]
  initialStudioOutputs: StudioOutput[]
  noteMode: boolean
  onNoteModeChange: (active: boolean) => void
}) {
  const t = useTranslations("notes")
  const tStudio = useTranslations("studio")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const [collapsed, setCollapsed] = useState(false)
  const [notesList, setNotesList] = useState<Note[]>(initialNotes)
  const [studioOutputsList, setStudioOutputsList] = useState<StudioOutput[]>(initialStudioOutputs)
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [activeQuiz, setActiveQuiz] = useState<StudioOutput | null>(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [renamingOutput, setRenamingOutput] = useState<StudioOutput | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [isSettingSource, setIsSettingSource] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const outputs: OutputItem[] = [
    ...notesList.map(noteToOutputItem),
    ...studioOutputsList.map((o) => studioOutputToItem(o, tStudio)),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  useEffect(() => {
    async function onSaveAsNote(e: Event) {
      const { content, sourceMessageId } = (e as CustomEvent<{ content: string; sourceMessageId?: string }>).detail
      const note = await createNote(notebookId, t("defaultTitle"), content, sourceMessageId)
      if (!note) return
      setNotesList((prev) => [note, ...prev])
      toast.success(t("createSuccess"))
      if (collapsed) setCollapsed(false)
    }
    window.addEventListener(NOTE_FROM_CHAT_EVENT, onSaveAsNote)
    return () => window.removeEventListener(NOTE_FROM_CHAT_EVENT, onSaveAsNote)
  }, [notebookId, collapsed, t])

  async function handleNewNote() {
    const note = await createNote(notebookId, t("defaultTitle"), "")
    if (!note) return
    setNotesList((prev) => [note, ...prev])
    openNoteDetail(note)
  }

  function openNoteDetail(note: Note) {
    setActiveNote(note)
    setEditTitle(note.title)
    setEditContent(note.content)
    setCollapsed(false)
    onNoteModeChange(true)
  }

  function closeNoteDetail() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setActiveNote(null)
    onNoteModeChange(false)
  }

  function handleOutputClick(item: OutputItem) {
    if (item.kind === "note" && item.note) openNoteDetail(item.note)
    else if (item.kind === "quiz") {
      const output = studioOutputsList.find((o) => o.id === item.id)
      if (output) openQuiz(output)
    } else devTodo(item.kind)
  }

  function openQuiz(output: StudioOutput) {
    setActiveQuiz(output)
    setActiveNote(null)
    setCollapsed(false)
    onNoteModeChange(true)
  }

  function closeQuiz() {
    setActiveQuiz(null)
    onNoteModeChange(false)
  }

  async function generateQuiz(focusTopic?: string, outputId?: string) {
    setQuizLoading(true)
    try {
      const res = await fetch("/api/studio/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, focusTopic, outputId }),
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string }
        if (error === "NO_SOURCES") toast.error(tStudio("quizNoSources"))
        else toast.error(tStudio("quizError"))
        return
      }
      const raw = (await res.json()) as StudioOutput & { createdAt: string }
      const output: StudioOutput = { ...raw, createdAt: new Date(raw.createdAt) }
      if (outputId) {
        setStudioOutputsList((prev) => prev.map((o) => (o.id === outputId ? output : o)))
      } else {
        setStudioOutputsList((prev) => [output, ...prev])
      }
      openQuiz(output)
    } catch {
      toast.error(tStudio("quizError"))
    } finally {
      setQuizLoading(false)
    }
  }

  function scheduleSave(title: string, content: string, noteId: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      await updateNote(noteId, notebookId, title, content)
      setNotesList((prev) => prev.map((n) => (n.id === noteId ? { ...n, title, content } : n)))
    }, 1000)
  }

  function handleTitleChange(value: string) {
    setEditTitle(value)
    if (activeNote) scheduleSave(value, editContent, activeNote.id)
  }

  function handleContentChange(value: string) {
    setEditContent(value)
    if (activeNote) scheduleSave(editTitle, value, activeNote.id)
  }

  async function setNoteAsSource(title: string, content: string) {
    const text = [title, content].filter(Boolean).join("\n\n").trim()
    if (!text) return

    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("")

    const checkRes = await fetch(
      `/api/sources/check?notebookId=${encodeURIComponent(notebookId)}&hash=${encodeURIComponent(hash)}`
    )
    if (checkRes.ok) {
      const { duplicate } = (await checkRes.json()) as { duplicate: { title: string } | null }
      if (duplicate) {
        toast.warning(t("setAsSourceDuplicate"))
        return
      }
    }

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          type: "text",
          title: title || t("defaultTitle"),
          text,
          fileHash: hash,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(t("setAsSourceSuccess"))
      window.location.reload()
    } catch {
      toast.error(t("setAsSourceError"))
    }
  }

  async function handleSetAsSource() {
    if (!activeNote) return
    setIsSettingSource(true)
    await setNoteAsSource(editTitle, editContent)
    setIsSettingSource(false)
  }

  async function handleSetAllAsSource() {
    const SEPARATOR = "\n\n" + "-".repeat(80) + "\n\n"
    const eligible = notesList.filter((n) => n.content.trim().length >= 5)

    if (eligible.length === 0) {
      toast.warning(t("setAllAsSourceEmpty"))
      return
    }

    const text = eligible
      .map((n) => [n.title, n.content.trim()].filter(Boolean).join("\n\n"))
      .join(SEPARATOR)

    if (text.length > 10_000) {
      toast.error(t("setAllAsSourceTooLong"))
      return
    }

    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("")

    const checkRes = await fetch(
      `/api/sources/check?notebookId=${encodeURIComponent(notebookId)}&hash=${encodeURIComponent(hash)}`
    )
    if (checkRes.ok) {
      const { duplicate } = (await checkRes.json()) as { duplicate: { title: string } | null }
      if (duplicate) {
        toast.warning(t("setAsSourceDuplicate"))
        return
      }
    }

    const title = `${t("allNotesSourcePrefix")} ${new Date().toLocaleDateString(locale)}`

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, type: "text", title, text, fileHash: hash }),
      })
      if (!res.ok) throw new Error()
      toast.success(t("setAllAsSourceSuccess"))
      window.location.reload()
    } catch {
      toast.error(t("setAsSourceError"))
    }
  }

  async function handleExportToSheets(note: Note) {
    try {
      const url = await exportNoteToGoogleSheets(note.title, note.content)
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "NO_TABLES") toast.warning(t("exportToSheetsNoTables"))
        else if (err.message !== "OAuth failed") toast.error(err.message)
      }
    }
  }

  async function handleExportToDocs(note: Note) {
    try {
      const url = await exportNoteToGoogleDocs(note.title, note.content)
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      if (err instanceof Error && err.message !== "OAuth failed") {
        toast.error(err.message)
      }
    }
  }

  async function handleRenameStudioOutput() {
    if (!renamingOutput || !renameValue.trim()) return
    const res = await fetch(`/api/studio/quiz/${renamingOutput.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: renameValue.trim() }),
    })
    if (!res.ok) { toast.error(tStudio("renameError")); return }
    const updated = (await res.json()) as StudioOutput & { createdAt: string }
    const output = { ...updated, createdAt: new Date(updated.createdAt) }
    setStudioOutputsList((prev) => prev.map((o) => (o.id === output.id ? output : o)))
    if (activeQuiz?.id === output.id) setActiveQuiz(output)
    setRenamingOutput(null)
  }

  async function handleDeleteStudioOutput(outputId: string) {
    setStudioOutputsList((prev) => prev.filter((o) => o.id !== outputId))
    if (activeQuiz?.id === outputId) closeQuiz()
    await fetch(`/api/studio/quiz/${outputId}`, { method: "DELETE" })
  }

  async function handleDeleteNote(noteId: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setNotesList((prev) => prev.filter((n) => n.id !== noteId))
    if (activeNote?.id === noteId) closeNoteDetail()
    await deleteNote(noteId, notebookId)
    toast.success(t("deleteSuccess"))
  }

  return (
    <>
    <aside
      className={cn(
        "flex shrink-0 flex-col border-l bg-background transition-all duration-200",
        collapsed ? "w-12" : noteMode ? "flex-1" : "w-96"
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-3">
        {!collapsed && (
          <span className="text-sm font-medium">
            {activeNote ? t("title") : activeQuiz ? tStudio("quiz") : tStudio("title")}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-7 shrink-0", collapsed && "mx-auto")}
          onClick={() => {
            if (collapsed) setCollapsed(false)
            else {
              setCollapsed(true)
              if (activeNote) closeNoteDetail()
              if (activeQuiz) closeQuiz()
            }
          }}
        >
          {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
        </Button>
      </div>

      {!collapsed && (
        activeQuiz ? (
          /* ── Quiz view ── */
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex h-10 shrink-0 items-center justify-between border-b px-2">
              <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={closeQuiz}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs font-medium">{tStudio("quiz")}</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={quizLoading} onClick={() => generateQuiz()}>
                {tStudio("quizRegenerate")}
              </Button>
            </div>
            {quizLoading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {tStudio("quizGenerating")}
              </div>
            ) : (
              <QuizView
                key={activeQuiz.id}
                data={activeQuiz.data as QuizData}
                notebookId={notebookId}
                outputId={activeQuiz.id}
                onRegenerate={() => generateQuiz()}
                onNewQuizFromTopic={(topic, id) => generateQuiz(topic, id)}
              />
            )}
          </div>
        ) : activeNote ? (
          /* ── Note detail view ── */
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Sub-header: back + "Aus Chat" badge */}
            <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
              <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={closeNoteDetail}>
                <ChevronLeft className="size-4" />
              </Button>
              {activeNote.sourceMessageId && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {t("fromChat")}
                </span>
              )}
            </div>

            {/* Title input */}
            <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
              <input
                value={editTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t("defaultTitle")}
                className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("deleteNote")}
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDeleteNote(activeNote.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            {/* TipTap editor */}
            <NoteEditor
              key={activeNote.id}
              initialContent={editContent}
              placeholder={t("placeholder")}
              onChange={handleContentChange}
            />

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetAsSource}
                disabled={isSettingSource || editContent.trim().length < 5}
              >
                {t("setAsSource")}
              </Button>
              {(() => {
                const len = editContent.trim().length
                const belowMin = len < 5
                return (
                  <span className={`text-xs ${belowMin ? "text-destructive" : "text-muted-foreground"}`}>
                    {belowMin
                      ? `${len}/5`
                      : `${len.toLocaleString()}/10.000`}
                  </span>
                )
              })()}
            </div>
          </div>
        ) : (
          /* ── List view ── */
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col overflow-y-auto pb-16">
              {/* Studio tools grid */}
              <div className="grid grid-cols-2 gap-2 p-3">
                {STUDIO_TOOLS.map((tool) => {
                  const Icon = tool.icon
                  return (
                    <button
                      key={tool.id}
                      className="flex items-center justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted"
                      disabled={tool.id === "quiz" && quizLoading}
                      onClick={() => tool.id === "quiz" ? generateQuiz() : devTodo(tool.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="text-xs font-medium leading-tight">{tStudio(tool.labelKey)}</span>
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

              {/* Unified outputs section */}
              <div className="flex flex-col gap-1 p-3">
                <span className="pb-1 text-xs font-medium text-muted-foreground">{t("outputsTitle")}</span>

                {outputs.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">{t("noOutputs")}</p>
                ) : (
                  <ul className="space-y-0.5">
                    {outputs.map((item) => (
                      <li key={item.id} className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted">
                        {outputIcon(item.kind)}
                        <button className="min-w-0 flex-1 text-left" onClick={() => handleOutputClick(item)}>
                          <p className="truncate text-sm">
                            {item.title || <span className="italic text-muted-foreground">{t("placeholder")}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{relativeTime(item.createdAt)}</p>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted-foreground/20 group-hover:opacity-100 focus:opacity-100">
                            <MoreHorizontal className="size-4 text-muted-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="bottom" align="end" className="w-max">
                            {item.kind === "note" ? (
                              <>
                                <DropdownMenuItem className="whitespace-nowrap" onClick={() => item.note && setNoteAsSource(item.note.title, item.note.content)} disabled={!item.note}>
                                  <BookmarkPlus className="size-4" />{t("setAsSource")}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="whitespace-nowrap" onClick={handleSetAllAsSource}>
                                  <Library className="size-4" />{t("setAllAsSource")}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="whitespace-nowrap" onClick={() => item.note && handleExportToDocs(item.note)} disabled={!item.note}>
                                  <FileText className="size-4" />{t("exportToDocs")}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="whitespace-nowrap" onClick={() => item.note && handleExportToSheets(item.note)} disabled={!item.note}>
                                  <Table2 className="size-4" />{t("exportToSheets")}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="whitespace-nowrap text-destructive focus:text-destructive" onClick={() => handleDeleteNote(item.id)}>
                                  <Trash2 className="size-4" />{t("deleteNote")}
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem className="whitespace-nowrap" onClick={() => devTodo("share")}>
                                  <Share2 className="size-4" />{tStudio("share")}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="whitespace-nowrap" onClick={() => { setRenamingOutput(studioOutputsList.find((o) => o.id === item.id) ?? null); setRenameValue(item.title) }}>
                                  <Pencil className="size-4" />{tStudio("rename")}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="whitespace-nowrap" onClick={() => devTodo("viewPrompt")}>
                                  <History className="size-4" />{tStudio("viewPrompt")}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="whitespace-nowrap text-destructive focus:text-destructive" onClick={() => handleDeleteStudioOutput(item.id)}>
                                  <Trash2 className="size-4" />{tStudio("delete")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* FAB */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <button
                onClick={handleNewNote}
                className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-md transition-colors hover:bg-muted"
              >
                <StickyNote className="size-4 text-muted-foreground" />
                {t("addNote")}
              </button>
            </div>
          </div>
        )
      )}
    </aside>

    <Dialog open={!!renamingOutput} onOpenChange={(open) => !open && setRenamingOutput(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tStudio("rename")}</DialogTitle>
        </DialogHeader>
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRenameStudioOutput()}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setRenamingOutput(null)}>{tCommon("cancel")}</Button>
          <Button onClick={handleRenameStudioOutput} disabled={!renameValue.trim()}>{tCommon("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

