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
  Loader2,
  ExternalLink,
  FileDown,
  Play,
  RefreshCw,
  Maximize2,
  ThumbsUp,
  ThumbsDown,
  Plus,
  X,
} from "lucide-react"
import {
  FaMicrophone,
  FaProjectDiagram,
  FaTable,
  FaQuestionCircle,
  FaSlideshare,
  FaClone,
  FaNewspaper,
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
import type { QuizData, QuizUsedSource } from "./quiz-view"
import { QuizSourcesModal } from "./quiz-sources-modal"
import { FlashcardView } from "./flashcard-view"
import type { FlashcardData, FlashcardUsedSource } from "./flashcard-view"
import { FlashcardCustomizeModal } from "./flashcard-customize-modal"
import { SlidedeckModal } from "./slidedeck-modal"
import { SlidedeckViewer } from "./slidedeck-viewer"
import { SlidedeckRevisionModal } from "./slidedeck-revision-modal"
import type { SlidedeckUsedSource } from "./slidedeck-modal"
import { exportToGoogleSlides, slidesUrlToExportUrl } from "@/lib/google-slides-export"
import type { SlideData } from "@/lib/google-slides-export"
import { MindmapCanvas } from "./mindmap-canvas"
import { MindmapSourcesModal } from "./mindmap-sources-modal"
import type { MindmapData } from "@/app/api/studio/mindmap/route"
import { AudioPlayer } from "./audio-player"
import { AudioSourcesModal } from "./audio-sources-modal"
import type { AudioData, AudioFormat, AudioLength } from "@/app/api/studio/audio/route"
import { DatatableView } from "./datatable-view"
import { DatatableCustomizeModal } from "./datatable-customize-modal"
import { DatatableSourcesModal } from "./datatable-sources-modal"
import type { DatatableData } from "@/app/api/studio/datatable/route"
import { ReportView } from "./report-view"
import type { ReportData } from "./report-view"
import { ReportFormatModal } from "./report-format-modal"
import { toast } from "sonner"
import type { Note, StudioOutput } from "@/db/schema"

const STUDIO_TOOLS = [
  {
    id: "audio",
    labelKey: "audio",
    icon: FaMicrophone,
    badge: null,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    id: "slidedeck",
    labelKey: "slidedeck",
    icon: FaSlideshare,
    badge: "BETA",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    id: "mindmap",
    labelKey: "mindmap",
    icon: FaProjectDiagram,
    badge: null,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    id: "datatable",
    labelKey: "datatable",
    icon: FaTable,
    badge: null,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    id: "quiz",
    labelKey: "quiz",
    icon: FaQuestionCircle,
    badge: null,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    id: "flashcards",
    labelKey: "flashcards",
    icon: FaClone,
    badge: null,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    id: "report",
    labelKey: "report",
    icon: FaNewspaper,
    badge: null,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
] as const

export const NOTE_FROM_CHAT_EVENT = "notebook:save-as-note"

type OutputKind = "note" | StudioOutput["type"]

type OutputItem = {
  id: string
  kind: OutputKind
  title: string
  createdAt: Date
  note?: Note
  loading?: boolean
}

function outputIcon(kind: OutputKind) {
  switch (kind) {
    case "audio":
      return <FaMicrophone className="size-4 shrink-0 text-violet-400" />
    case "mindmap":
      return <FaProjectDiagram className="size-4 shrink-0 text-emerald-400" />
    case "slidedeck":
      return <FaSlideshare className="size-4 shrink-0 text-orange-400" />
    case "datatable":
      return <FaTable className="size-4 shrink-0 text-sky-400" />
    case "quiz":
      return <FaQuestionCircle className="size-4 shrink-0 text-amber-400" />
    case "flashcards":
      return <FaClone className="size-4 shrink-0 text-rose-400" />
    case "report":
      return <FaNewspaper className="size-4 shrink-0 text-blue-400" />
    default:
      return <StickyNote className="size-4 shrink-0 text-blue-400" />
  }
}

function relativeTime(date: Date, locale: string): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (diff < 60) return rtf.format(-diff, "second")
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), "minute")
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), "hour")
  return rtf.format(-Math.floor(diff / 86400), "day")
}

function noteToOutputItem(note: Note): OutputItem {
  return { id: note.id, kind: "note", title: note.title, createdAt: note.createdAt, note }
}

function studioOutputToItem(o: StudioOutput, tStudio: (k: string) => string): OutputItem {
  return {
    id: o.id,
    kind: o.type,
    title: o.title ?? tStudio(o.type),
    createdAt: o.createdAt,
    loading: o.status === "generating",
  }
}

export function StudioSidebar({
  notebookId,
  initialNotes,
  initialStudioOutputs,
  initialReadySourceCount,
  noteMode,
  onNoteModeChange,
}: {
  notebookId: string
  initialNotes: Note[]
  initialStudioOutputs: StudioOutput[]
  initialReadySourceCount: number
  noteMode: boolean
  onNoteModeChange: (active: boolean) => void
}) {
  const t = useTranslations("notes")
  const tStudio = useTranslations("studio")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const [collapsed, setCollapsed] = useState(false)
  const [activeSourceCount, setActiveSourceCount] = useState(initialReadySourceCount)
  const [notesList, setNotesList] = useState<Note[]>(initialNotes)
  const [studioOutputsList, setStudioOutputsList] = useState<StudioOutput[]>(initialStudioOutputs)
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [activeQuiz, setActiveQuiz] = useState<StudioOutput | null>(null)
  const [activeSlidedeck, setActiveSlidedeck] = useState<StudioOutput | null>(null)
  const [activeFlashcards, setActiveFlashcards] = useState<StudioOutput | null>(null)
  const [activeMindmap, setActiveMindmap] = useState<StudioOutput | null>(null)
  const [activeAudio, setActiveAudio] = useState<StudioOutput | null>(null)
  const [activeDatatable, setActiveDatatable] = useState<StudioOutput | null>(null)
  const [datatableModal, setDatatableModal] = useState<{ view: "sources" | "customize"; output: StudioOutput | null } | null>(null)
  const [datatableSourcesOutput, setDatatableSourcesOutput] = useState<StudioOutput | null>(null)
  const [activeReport, setActiveReport] = useState<StudioOutput | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [slideViewerOpen, setSlideViewerOpen] = useState(false)
  const [slideViewerIndex, setSlideViewerIndex] = useState(0)
  const [revisionModalOpen, setRevisionModalOpen] = useState(false)
  const [isRevising, setIsRevising] = useState(false)
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null)
  const [editSlide, setEditSlide] = useState<{ title: string; bullets: string[] } | null>(null)
  const [quizViewLoading, setQuizViewLoading] = useState(false)
  const [flashcardsViewLoading, setFlashcardsViewLoading] = useState(false)
  const [renamingOutput, setRenamingOutput] = useState<StudioOutput | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [sourcesModalOutput, setSourcesModalOutput] = useState<StudioOutput | null>(null)
  const [flashcardsModalOutput, setFlashcardsModalOutput] = useState<StudioOutput | null>(null)
  const [mindmapModalOutput, setMindmapModalOutput] = useState<StudioOutput | null>(null)
  const [audioModalOutput, setAudioModalOutput] = useState<StudioOutput | null>(null)
  const [slidedeckModalOutput, setSlidedeckModalOutput] = useState<StudioOutput | null>(null)
  const [slidedeckModalView, setSlidedeckModalView] = useState<"sources" | "customize">("sources")
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [isSettingSource, setIsSettingSource] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const outputs: OutputItem[] = [
    ...notesList.map(noteToOutputItem),
    ...studioOutputsList.map((o) => studioOutputToItem(o, tStudio)),
  ].sort((a, b) => (a.loading ? -1 : b.loading ? 1 : b.createdAt.getTime() - a.createdAt.getTime()))

  useEffect(() => {
    function onSourceCountChange(e: Event) {
      setActiveSourceCount((e as CustomEvent<{ count: number }>).detail.count)
    }
    window.addEventListener("notebook:source-count-change", onSourceCountChange)
    return () => window.removeEventListener("notebook:source-count-change", onSourceCountChange)
  }, [])

  useEffect(() => {
    async function onSaveAsNote(e: Event) {
      const { title, content, sourceMessageId } = (
        e as CustomEvent<{ title?: string; content: string; sourceMessageId?: string }>
      ).detail
      const note = await createNote(notebookId, title ?? t("defaultTitle"), content, sourceMessageId)
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
    } else if (item.kind === "slidedeck") {
      const output = studioOutputsList.find((o) => o.id === item.id)
      if (output) openSlidedeck(output)
    } else if (item.kind === "flashcards") {
      const output = studioOutputsList.find((o) => o.id === item.id)
      if (output) openFlashcards(output)
    } else if (item.kind === "mindmap") {
      const output = studioOutputsList.find((o) => o.id === item.id)
      if (output) openMindmap(output)
    } else if (item.kind === "audio") {
      const output = studioOutputsList.find((o) => o.id === item.id)
      if (output) openAudio(output)
    } else if (item.kind === "datatable") {
      const output = studioOutputsList.find((o) => o.id === item.id)
      if (output) openDatatable(output)
    } else if (item.kind === "report") {
      const output = studioOutputsList.find((o) => o.id === item.id)
      if (output) openReport(output)
    } else devTodo(item.kind)
  }

  // Refs for stable access inside polling closure
  const activeQuizRef = useRef(activeQuiz)
  useEffect(() => {
    activeQuizRef.current = activeQuiz
  }, [activeQuiz])
  const activeSlidedeckRef = useRef(activeSlidedeck)
  useEffect(() => {
    activeSlidedeckRef.current = activeSlidedeck
  }, [activeSlidedeck])
  const activeFlashcardsRef = useRef(activeFlashcards)
  useEffect(() => {
    activeFlashcardsRef.current = activeFlashcards
  }, [activeFlashcards])
  const activeMindmapRef = useRef(activeMindmap)
  useEffect(() => {
    activeMindmapRef.current = activeMindmap
  }, [activeMindmap])
  const activeAudioRef = useRef(activeAudio)
  useEffect(() => {
    activeAudioRef.current = activeAudio
  }, [activeAudio])
  const activeDatatableRef = useRef(activeDatatable)
  useEffect(() => {
    activeDatatableRef.current = activeDatatable
  }, [activeDatatable])
  const activeReportRef = useRef(activeReport)
  useEffect(() => {
    activeReportRef.current = activeReport
  }, [activeReport])
  const onNoteModeChangeRef = useRef(onNoteModeChange)
  useEffect(() => {
    onNoteModeChangeRef.current = onNoteModeChange
  }, [onNoteModeChange])
  // outputId → what to do when ready
  const pendingActionsRef = useRef<Map<string, "open-quiz" | "create-slides" | "open-flashcards" | "open-mindmap" | "open-audio" | "open-datatable" | "open-report">>(
    new Map()
  )
  const processedIdsRef = useRef<Set<string>>(new Set())
  const generatingIdsRef = useRef<string[]>([])

  useEffect(() => {
    generatingIdsRef.current = studioOutputsList
      .filter((o) => o.status === "generating")
      .map((o) => o.id)
  }, [studioOutputsList])

  // Single polling interval — one request fetches ALL generating outputs at once
  useEffect(() => {
    const interval = setInterval(async () => {
      const ids = generatingIdsRef.current
      if (ids.length === 0) return

      try {
        const params = new URLSearchParams(ids.map((id) => ["id", id]))
        const res = await fetch(`/api/studio/status?${params}`)
        if (!res.ok) return

        const statuses = (await res.json()) as Array<{
          id: string
          status: string
          output?: StudioOutput & { createdAt: string }
        }>

        const readyOutputs: StudioOutput[] = []
        const errorIds: string[] = []

        for (const s of statuses) {
          if (processedIdsRef.current.has(s.id)) continue
          if (s.status === "ready" && s.output) {
            processedIdsRef.current.add(s.id)
            readyOutputs.push({ ...s.output, createdAt: new Date(s.output.createdAt) })
          } else if (s.status === "error") {
            processedIdsRef.current.add(s.id)
            errorIds.push(s.id)
          }
        }

        if (readyOutputs.length > 0 || errorIds.length > 0) {
          if (errorIds.length > 0) {
            setStudioOutputsList((prev) => {
              for (const id of errorIds) {
                const failed = prev.find((o) => o.id === id)
                if (failed) {
                  const key = failed.type === "audio" ? "audioError"
                    : failed.type === "mindmap" ? "mindmapError"
                    : failed.type === "quiz" ? "quizError"
                    : failed.type === "flashcards" ? "flashcardsError"
                    : failed.type === "slidedeck" ? "slidedeckError"
                    : "mindmapError"
                  toast.error(tStudio(key as Parameters<typeof tStudio>[0]))
                }
              }
              return prev.filter((o) => !errorIds.includes(o.id))
            })
          }
          setStudioOutputsList((prev) => {
            const next = prev.map((o) => readyOutputs.find((r) => r.id === o.id) ?? o)
            return next
          })

          for (const output of readyOutputs) {
            const action = pendingActionsRef.current.get(output.id)
            pendingActionsRef.current.delete(output.id)

            if (activeQuizRef.current?.id === output.id) {
              setActiveQuiz(output)
              setQuizViewLoading(false)
            }
            if (activeSlidedeckRef.current?.id === output.id) {
              setActiveSlidedeck(output)
            }
            if (activeFlashcardsRef.current?.id === output.id) {
              setActiveFlashcards(output)
              setFlashcardsViewLoading(false)
            }
            if (activeMindmapRef.current?.id === output.id) {
              setActiveMindmap(output)
            }
            if (activeAudioRef.current?.id === output.id) {
              setActiveAudio(output)
            }
            if (activeDatatableRef.current?.id === output.id) {
              setActiveDatatable(output)
            }
            if (activeReportRef.current?.id === output.id) {
              setActiveReport(output)
            }

            if (action === "open-quiz") {
              setActiveQuiz(output)
              setActiveNote(null)
              setActiveSlidedeck(null)
              setActiveFlashcards(null)
              setActiveMindmap(null)
              setCollapsed(false)
              onNoteModeChangeRef.current(true)
            } else if (action === "open-flashcards") {
              setActiveFlashcards(output)
              setActiveNote(null)
              setActiveQuiz(null)
              setActiveSlidedeck(null)
              setActiveMindmap(null)
              setCollapsed(false)
              onNoteModeChangeRef.current(true)
            } else if (action === "open-mindmap") {
              setActiveMindmap(output)
              setActiveNote(null)
              setActiveQuiz(null)
              setActiveSlidedeck(null)
              setActiveFlashcards(null)
              setCollapsed(false)
              onNoteModeChangeRef.current(true)
            } else if (action === "open-audio") {
              setActiveAudio(output)
              setActiveNote(null)
              setActiveQuiz(null)
              setActiveSlidedeck(null)
              setActiveFlashcards(null)
              setActiveMindmap(null)
              setCollapsed(false)
              onNoteModeChangeRef.current(true)
            } else if (action === "open-datatable") {
              setActiveDatatable(output)
              setActiveNote(null)
              setActiveQuiz(null)
              setActiveSlidedeck(null)
              setActiveFlashcards(null)
              setActiveMindmap(null)
              setCollapsed(false)
              onNoteModeChangeRef.current(true)
            } else if (action === "open-report") {
              setActiveReport(output)
              setActiveNote(null)
              setActiveQuiz(null)
              setActiveSlidedeck(null)
              setActiveFlashcards(null)
              setActiveMindmap(null)
              setActiveDatatable(null)
              setCollapsed(false)
              onNoteModeChangeRef.current(true)
            } else if (action === "create-slides") {
              // Open detail view; Google Slides creation triggered by user clicking the button
              setActiveSlidedeck(output)
              setActiveNote(null)
              setActiveQuiz(null)
              setCollapsed(false)
              onNoteModeChangeRef.current(true)
              toast.success(tStudio("slidedeckReady"), {
                action: {
                  label: tStudio("slidedeckOpen"),
                  onClick: () => void createGoogleSlidesForOutput(output),
                },
                duration: 10000,
              })
            }
          }

          if (errorIds.length > 0) toast.error(tStudio("generationError"))
        }
      } catch {
        // ignore transient polling errors
      }
    }, 2000)

    return () => clearInterval(interval)
  }, []) // runs once; uses refs for dynamic data

  function openQuiz(output: StudioOutput) {
    setActiveQuiz(output)
    setActiveNote(null)
    setActiveFlashcards(null)
    setCollapsed(false)
    onNoteModeChange(true)
  }

  function closeQuiz() {
    setActiveQuiz(null)
    onNoteModeChange(false)
  }

  function openFlashcards(output: StudioOutput) {
    setActiveFlashcards(output)
    setActiveNote(null)
    setActiveQuiz(null)
    setCollapsed(false)
    onNoteModeChange(true)
  }

  function closeFlashcards() {
    setActiveFlashcards(null)
    onNoteModeChange(false)
  }

  function openMindmap(output: StudioOutput) {
    setActiveMindmap(output)
    setActiveNote(null)
    setActiveQuiz(null)
    setActiveFlashcards(null)
    setActiveSlidedeck(null)
    setCollapsed(false)
    onNoteModeChange(true)
  }

  function closeMindmap() {
    setActiveMindmap(null)
    onNoteModeChange(false)
  }

  function openAudio(output: StudioOutput) {
    setActiveAudio(output)
    setActiveNote(null)
    setActiveQuiz(null)
    setActiveFlashcards(null)
    setActiveSlidedeck(null)
    setActiveMindmap(null)
    setActiveDatatable(null)
    setActiveReport(null)
    setCollapsed(false)
    onNoteModeChange(true)
  }

  function closeAudio() {
    setActiveAudio(null)
    onNoteModeChange(false)
  }

  function openDatatable(output: StudioOutput) {
    setActiveDatatable(output)
    setActiveNote(null)
    setActiveQuiz(null)
    setActiveFlashcards(null)
    setActiveSlidedeck(null)
    setActiveMindmap(null)
    setActiveReport(null)
    setCollapsed(false)
    onNoteModeChange(true)
  }

  function closeDatatable() {
    setActiveDatatable(null)
    onNoteModeChange(false)
  }

  function openReport(output: StudioOutput) {
    setActiveReport(output)
    setActiveNote(null)
    setActiveQuiz(null)
    setActiveFlashcards(null)
    setActiveSlidedeck(null)
    setActiveMindmap(null)
    setActiveDatatable(null)
    setCollapsed(false)
    onNoteModeChange(true)
  }

  function closeReport() {
    setActiveReport(null)
    onNoteModeChange(false)
  }

  function openSlidedeck(output: StudioOutput) {
    setActiveSlidedeck(output)
    setActiveQuiz(null)
    setActiveFlashcards(null)
    setActiveNote(null)
    setCollapsed(false)
    onNoteModeChange(true)
  }

  function closeSlidedeck() {
    setActiveSlidedeck(null)
    setEditingSlideIndex(null)
    setEditSlide(null)
    onNoteModeChange(false)
  }

  function startEditSlide(index: number, slide: { title: string; bullets: string[] }) {
    setEditingSlideIndex(index)
    setEditSlide({ title: slide.title, bullets: [...slide.bullets] })
  }

  function cancelEditSlide() {
    setEditingSlideIndex(null)
    setEditSlide(null)
  }

  async function handleRevise(instructions: Record<number, string>) {
    if (!activeSlidedeck) return
    setIsRevising(true)
    const slideData = activeSlidedeck.data as SlideData & { language?: string; format?: string; length?: string }
    await generateSlidedeck(
      {
        language: slideData.language ?? "de",
        format: (slideData.format as "detailed" | "presenter") ?? "detailed",
        length: (slideData.length as "short" | "standard") ?? "standard",
        revisionInstructions: Object.fromEntries(Object.entries(instructions).map(([k, v]) => [k, v])),
        existingSlides: (slideData as SlideData).slides.map((s) => ({ title: s.title, bullets: s.bullets })),
      },
      activeSlidedeck.id
    )
    setIsRevising(false)
    setRevisionModalOpen(false)
    closeSlidedeck()
  }

  async function saveSlideEdit() {
    if (editingSlideIndex === null || !editSlide || !activeSlidedeck) return
    const slideData = activeSlidedeck.data as SlideData & { usedSources?: SlidedeckUsedSource[]; language?: string; slidesUrl?: string }
    const newSlides = slideData.slides.map((s, i) =>
      i === editingSlideIndex
        ? { ...s, title: editSlide.title, bullets: editSlide.bullets.filter((b) => b.trim()) }
        : s
    )
    const newData = { ...slideData, slides: newSlides }
    const updatedOutput = { ...activeSlidedeck, data: newData }

    setActiveSlidedeck(updatedOutput)
    setStudioOutputsList((prev) => prev.map((o) => (o.id === activeSlidedeck.id ? updatedOutput : o)))
    setEditingSlideIndex(null)
    setEditSlide(null)

    await fetch(`/api/studio/slidedeck/${activeSlidedeck.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: newData }),
    })
  }

  async function createGoogleSlidesForOutput(output: StudioOutput) {
    const slideData = output.data as SlideData & { slidesUrl?: string }
    if (slideData?.slidesUrl) return

    let slidesUrl: string | undefined
    try {
      slidesUrl = await exportToGoogleSlides(slideData)
    } catch (err) {
      if (err instanceof Error && err.message !== "OAuth failed") {
        toast.error(tStudio("slidedeckSlidesError"))
      }
    }

    if (slidesUrl) {
      await fetch(`/api/studio/slidedeck/${output.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slidesUrl }),
      })
      setStudioOutputsList((prev) =>
        prev.map((o) =>
          o.id === output.id ? { ...o, data: { ...(o.data as object), slidesUrl } } : o
        )
      )
      window.open(slidesUrl, "_blank", "noopener,noreferrer")
    }
  }

  function makeGeneratingPlaceholder(outputId: string, type: StudioOutput["type"]): StudioOutput {
    return {
      id: outputId,
      notebookId,
      type,
      status: "generating",
      title: null,
      shareToken: null,
      data: null,
      s3Key: null,
      createdAt: new Date(),
    }
  }

  async function generateQuiz(
    focusTopic?: string,
    existingOutputId?: string,
    count?: number,
    difficulty?: string
  ) {
    try {
      const res = await fetch("/api/studio/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          focusTopic,
          outputId: existingOutputId,
          count,
          difficulty,
        }),
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string }
        toast.error(error === "NO_SOURCES" ? tStudio("quizNoSources") : tStudio("quizError"))
        return
      }
      const { outputId } = (await res.json()) as { outputId: string }
      const placeholder = makeGeneratingPlaceholder(outputId, "quiz")

      if (existingOutputId) {
        setStudioOutputsList((prev) =>
          prev.map((o) => (o.id === existingOutputId ? placeholder : o))
        )
        if (activeQuizRef.current?.id === existingOutputId) setQuizViewLoading(true)
      } else {
        pendingActionsRef.current.set(outputId, "open-quiz")
        setStudioOutputsList((prev) => [placeholder, ...prev])
      }
    } catch {
      toast.error(tStudio("quizError"))
    }
  }

  async function generateFlashcards(
    focusTopic?: string,
    existingOutputId?: string,
    count?: number,
    difficulty?: string
  ) {
    try {
      const res = await fetch("/api/studio/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          focusTopic,
          outputId: existingOutputId,
          count,
          difficulty,
        }),
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string }
        toast.error(
          error === "NO_SOURCES" ? tStudio("flashcardsNoSources") : tStudio("flashcardsError")
        )
        return
      }
      const { outputId } = (await res.json()) as { outputId: string }
      const placeholder = makeGeneratingPlaceholder(outputId, "flashcards")

      if (existingOutputId) {
        setStudioOutputsList((prev) =>
          prev.map((o) => (o.id === existingOutputId ? placeholder : o))
        )
        if (activeFlashcardsRef.current?.id === existingOutputId) setFlashcardsViewLoading(true)
      } else {
        pendingActionsRef.current.set(outputId, "open-flashcards")
        setStudioOutputsList((prev) => [placeholder, ...prev])
      }
    } catch {
      toast.error(tStudio("flashcardsError"))
    }
  }

  async function generateReport(format: string, language: string, customPrompt?: string, existingOutputId?: string) {
    try {
      const res = await fetch("/api/studio/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, format, language, customPrompt, outputId: existingOutputId }),
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string }
        toast.error(error === "NO_SOURCES" ? tStudio("reportNoSources") : tStudio("reportError"))
        return
      }
      const { outputId } = (await res.json()) as { outputId: string }
      const placeholder = makeGeneratingPlaceholder(outputId, "report")
      if (existingOutputId) {
        setStudioOutputsList((prev) => prev.map((o) => (o.id === existingOutputId ? placeholder : o)))
        if (activeReportRef.current?.id === existingOutputId) setActiveReport(placeholder)
      } else {
        pendingActionsRef.current.set(outputId, "open-report")
        setStudioOutputsList((prev) => [placeholder, ...prev])
      }
    } catch {
      toast.error(tStudio("reportError"))
    }
  }

  async function generateDatatable(
    options?: { language?: string; focusTopic?: string },
    existingOutputId?: string
  ) {
    try {
      const res = await fetch("/api/studio/datatable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, outputId: existingOutputId, ...options }),
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string }
        toast.error(error === "NO_SOURCES" ? tStudio("datatableNoSources") : tStudio("datatableError"))
        return
      }
      const { outputId } = (await res.json()) as { outputId: string }
      const placeholder = makeGeneratingPlaceholder(outputId, "datatable")

      if (existingOutputId) {
        setStudioOutputsList((prev) =>
          prev.map((o) => (o.id === existingOutputId ? placeholder : o))
        )
        if (activeDatatableRef.current?.id === existingOutputId) setActiveDatatable(placeholder)
      } else {
        pendingActionsRef.current.set(outputId, "open-datatable")
        setStudioOutputsList((prev) => [placeholder, ...prev])
      }
    } catch {
      toast.error(tStudio("datatableError"))
    }
  }

  async function exportDatatableToSheets() {
    if (!activeDatatable?.data) return
    const data = activeDatatable.data as DatatableData
    const md = [
      `| ${data.headers.join(" | ")} |`,
      `| ${data.headers.map(() => "---").join(" | ")} |`,
      ...data.rows.map((r) => `| ${r.join(" | ")} |`),
    ].join("\n")
    try {
      const url = await exportNoteToGoogleSheets(data.title, md)
      window.open(url, "_blank", "noopener,noreferrer")
    } catch {
      toast.error(tStudio("datatableSheetsError"))
    }
  }

  async function generateMindmap(focusTopic?: string, existingOutputId?: string) {
    try {
      const res = await fetch("/api/studio/mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, focusTopic, outputId: existingOutputId }),
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string }
        toast.error(error === "NO_SOURCES" ? tStudio("mindmapNoSources") : tStudio("mindmapError"))
        return
      }
      const { outputId } = (await res.json()) as { outputId: string }
      const placeholder = makeGeneratingPlaceholder(outputId, "mindmap")

      if (existingOutputId) {
        setStudioOutputsList((prev) =>
          prev.map((o) => (o.id === existingOutputId ? placeholder : o))
        )
      } else {
        pendingActionsRef.current.set(outputId, "open-mindmap")
        setStudioOutputsList((prev) => [placeholder, ...prev])
      }
    } catch {
      toast.error(tStudio("mindmapError"))
    }
  }

  async function generateAudio(
    params?: { format?: AudioFormat; language?: string; length?: AudioLength; focusTopic?: string },
    existingOutputId?: string
  ) {
    try {
      const res = await fetch("/api/studio/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, outputId: existingOutputId, ...params }),
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string }
        toast.error(error === "NO_SOURCES" ? tStudio("audioNoSources") : tStudio("audioError"))
        return
      }
      const { outputId } = (await res.json()) as { outputId: string }
      const placeholder = makeGeneratingPlaceholder(outputId, "audio")

      if (existingOutputId) {
        setStudioOutputsList((prev) =>
          prev.map((o) => (o.id === existingOutputId ? placeholder : o))
        )
        if (activeAudioRef.current?.id === existingOutputId) setActiveAudio(placeholder)
      } else {
        pendingActionsRef.current.set(outputId, "open-audio")
        setStudioOutputsList((prev) => [placeholder, ...prev])
      }
    } catch {
      toast.error(tStudio("audioError"))
    }
  }

  async function generateSlidedeck(
    params?: {
      format?: string
      length?: string
      language?: string
      focusTopic?: string
      revisionInstructions?: Record<string, string>
      existingSlides?: Array<{ title: string; bullets: string[] }>
    },
    existingOutputId?: string
  ) {
    try {
      const res = await fetch("/api/studio/slidedeck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, outputId: existingOutputId, ...params }),
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string }
        toast.error(
          error === "NO_SOURCES" ? tStudio("slidedeckNoSources") : tStudio("slidedeckError")
        )
        return
      }
      const { outputId } = (await res.json()) as { outputId: string }
      const placeholder = makeGeneratingPlaceholder(outputId, "slidedeck")

      if (existingOutputId) {
        setStudioOutputsList((prev) =>
          prev.map((o) => (o.id === existingOutputId ? placeholder : o))
        )
      } else {
        pendingActionsRef.current.set(outputId, "create-slides")
        setStudioOutputsList((prev) => [placeholder, ...prev])
      }
    } catch {
      toast.error(tStudio("slidedeckError"))
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
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

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
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

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
    const apiBase =
      renamingOutput.type === "slidedeck" ? "slidedeck"
      : renamingOutput.type === "flashcards" ? "flashcards"
      : renamingOutput.type === "mindmap" ? "mindmap"
      : renamingOutput.type === "datatable" ? "datatable"
      : renamingOutput.type === "report" ? "report"
      : "quiz"
    const res = await fetch(`/api/studio/${apiBase}/${renamingOutput.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: renameValue.trim() }),
    })
    if (!res.ok) {
      toast.error(tStudio("renameError"))
      return
    }
    const updated = (await res.json()) as StudioOutput & { createdAt: string }
    const output = { ...updated, createdAt: new Date(updated.createdAt) }
    setStudioOutputsList((prev) => prev.map((o) => (o.id === output.id ? output : o)))
    if (activeQuiz?.id === output.id) setActiveQuiz(output)
    if (activeFlashcards?.id === output.id) setActiveFlashcards(output)
    if (activeReport?.id === output.id) setActiveReport(output)
    if (activeMindmap?.id === output.id) setActiveMindmap(output)
    if (activeDatatable?.id === output.id) setActiveDatatable(output)
    setRenamingOutput(null)
  }

  async function handleDeleteStudioOutput(outputId: string) {
    const output = studioOutputsList.find((o) => o.id === outputId)
    setStudioOutputsList((prev) => prev.filter((o) => o.id !== outputId))
    if (activeQuiz?.id === outputId) closeQuiz()
    if (activeFlashcards?.id === outputId) closeFlashcards()
    if (activeReport?.id === outputId) closeReport()
    if (activeMindmap?.id === outputId) closeMindmap()
    if (activeDatatable?.id === outputId) closeDatatable()
    const apiBase =
      output?.type === "slidedeck" ? "slidedeck"
      : output?.type === "flashcards" ? "flashcards"
      : output?.type === "mindmap" ? "mindmap"
      : output?.type === "datatable" ? "datatable"
      : output?.type === "report" ? "report"
      : "quiz"
    await fetch(`/api/studio/${apiBase}/${outputId}`, { method: "DELETE" })
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
          "bg-background flex flex-col border-l transition-all duration-200",
          collapsed ? "w-12 shrink-0" : noteMode ? "flex-1 min-w-0" : "w-96 shrink-0"
        )}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b px-3">
          {!collapsed && (
            <span className="text-sm font-medium">
              {activeNote
                ? t("title")
                : activeQuiz
                  ? tStudio("quiz")
                  : activeFlashcards
                    ? tStudio("flashcards")
                    : activeSlidedeck
                      ? tStudio("slidedeck")
                      : activeMindmap
                        ? tStudio("mindmap")
                        : activeDatatable
                          ? tStudio("datatable")
                          : activeReport
                            ? tStudio("report")
                            : tStudio("title")}
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
                if (activeFlashcards) closeFlashcards()
                if (activeReport) closeReport()
              }
            }}
          >
            {collapsed ? (
              <PanelRightOpen className="size-4" />
            ) : (
              <PanelRightClose className="size-4" />
            )}
          </Button>
        </div>

        {collapsed && (
          /* Collapsed icon strip */
          <div className="flex flex-col items-center gap-1 overflow-y-auto py-2">
            {STUDIO_TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.id}
                  title={tStudio(tool.labelKey)}
                  onClick={() => setCollapsed(false)}
                  className="hover:bg-muted flex size-8 items-center justify-center rounded-md transition-colors"
                >
                  <Icon className={cn("size-4", tool.color)} />
                </button>
              )
            })}
            {outputs.filter((item) => !item.loading).length > 0 && (
              <Separator className="my-1 w-6" />
            )}
            {outputs
              .filter((item) => !item.loading)
              .map((item) => (
                <button
                  key={item.id}
                  title={item.title || "—"}
                  onClick={() => handleOutputClick(item)}
                  className="hover:bg-muted flex size-8 items-center justify-center rounded-md transition-colors"
                >
                  {outputIcon(item.kind)}
                </button>
              ))}
          </div>
        )}

        {!collapsed &&
          (activeQuiz ? (
            /* ── Quiz view ── */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-10 shrink-0 items-center justify-between border-b px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={tCommon("back")}
                  onClick={closeQuiz}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs font-medium">{tStudio("quiz")}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={quizViewLoading}
                  onClick={() => generateQuiz(undefined, activeQuiz.id)}
                >
                  {tStudio("quizRegenerate")}
                </Button>
              </div>
              {quizViewLoading || !activeQuiz.data ? (
                <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
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
          ) : activeFlashcards ? (
            /* ── Flashcard view ── */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-10 shrink-0 items-center justify-between border-b px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={tCommon("back")}
                  onClick={closeFlashcards}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs font-medium">{tStudio("flashcards")}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={flashcardsViewLoading}
                  onClick={() => generateFlashcards(undefined, activeFlashcards.id)}
                >
                  {tStudio("flashcardsRegenerate")}
                </Button>
              </div>
              {flashcardsViewLoading || !activeFlashcards.data ? (
                <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
                  {tStudio("flashcardsGenerating")}
                </div>
              ) : (
                <FlashcardView
                  key={activeFlashcards.id}
                  data={activeFlashcards.data as FlashcardData}
                  notebookId={notebookId}
                  outputId={activeFlashcards.id}
                  onNewDeckFromTopic={(topic, id) => generateFlashcards(topic, id)}
                />
              )}
            </div>
          ) : activeSlidedeck ? (
            /* ── Slidedeck detail view ── */
            (() => {
              const slideData = activeSlidedeck.data as
                | (SlideData & {
                    usedSources?: SlidedeckUsedSource[]
                    language?: string
                    slidesUrl?: string
                  })
                | null
              const slidesUrl = slideData?.slidesUrl
              const usedSources = slideData?.usedSources ?? []
              const slides = slideData?.slides ?? []
              return (
                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* Header */}
                  <div className="flex h-10 shrink-0 items-center gap-0.5 border-b px-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={closeSlidedeck}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="min-w-0 flex-1 truncate px-1 text-xs font-medium">
                      {slideData?.presentationTitle ??
                        activeSlidedeck.title ??
                        tStudio("slidedeck")}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      title={tStudio("rename")}
                      onClick={() => {
                        setRenamingOutput(activeSlidedeck)
                        setRenameValue(activeSlidedeck.title ?? "")
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      title={tStudio("slidedeckPresent")}
                      onClick={() => {
                        setSlideViewerIndex(0)
                        setSlideViewerOpen(true)
                      }}
                    >
                      <Play className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      title={tStudio("share")}
                      onClick={async () => {
                        if (slidesUrl) {
                          if (navigator.share)
                            await navigator
                              .share({ title: activeSlidedeck.title ?? undefined, url: slidesUrl })
                              .catch(() => undefined)
                          else {
                            await navigator.clipboard.writeText(slidesUrl)
                            toast.success(tStudio("shareCopied"))
                          }
                        } else toast.error(tStudio("slidedeckNoUrl"))
                      }}
                    >
                      <Share2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      title={tStudio("slidedeckOpen")}
                      onClick={() => {
                        if (slidesUrl) window.open(slidesUrl, "_blank", "noopener,noreferrer")
                        else void createGoogleSlidesForOutput(activeSlidedeck)
                      }}
                    >
                      <ExternalLink className="size-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="hover:bg-accent flex size-7 shrink-0 items-center justify-center rounded-md transition-colors">
                        <MoreHorizontal className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="bottom" align="end" className="w-max">
                        <DropdownMenuItem
                          className="whitespace-nowrap"
                          onClick={() => {
                            if (slidesUrl)
                              window.open(
                                slidesUrlToExportUrl(slidesUrl, "pdf"),
                                "_blank",
                                "noopener,noreferrer"
                              )
                            else toast.error(tStudio("slidedeckNoUrl"))
                          }}
                        >
                          <FileDown className="size-4" />
                          {tStudio("slidedeckExportPdf")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="whitespace-nowrap"
                          onClick={() => {
                            if (slidesUrl)
                              window.open(
                                slidesUrlToExportUrl(slidesUrl, "pptx"),
                                "_blank",
                                "noopener,noreferrer"
                              )
                            else toast.error(tStudio("slidedeckNoUrl"))
                          }}
                        >
                          <FileDown className="size-4" />
                          {tStudio("slidedeckExportPptx")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="whitespace-nowrap"
                          onClick={() => setRevisionModalOpen(true)}
                        >
                          <RefreshCw className="size-4" />
                          {tStudio("slidedeckRevise")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive whitespace-nowrap"
                          onClick={() => {
                            handleDeleteStudioOutput(activeSlidedeck.id)
                            closeSlidedeck()
                          }}
                        >
                          <Trash2 className="size-4" />
                          {tStudio("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Sources chip */}
                  {usedSources.length > 0 && (
                    <div className="shrink-0 px-3 pt-2">
                      <button
                        onClick={() => {
                          setSlidedeckModalView("sources")
                          setSlidedeckModalOutput(activeSlidedeck)
                        }}
                        className="bg-muted text-muted-foreground hover:bg-muted/70 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
                      >
                        {tStudio("slidedeckSourcesChip", { count: usedSources.length })}
                      </button>
                    </div>
                  )}

                  {/* Slides */}
                  <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3">
                    {slides.length === 0 ? (
                      <p className="text-muted-foreground py-8 text-center text-xs">
                        {tStudio("slidedeckGenerating")}
                      </p>
                    ) : (
                      slides.map((slide, i) => {
                        const isEditing = editingSlideIndex === i
                        return (
                          <div
                            key={i}
                            className={cn(
                              "group relative rounded-xl border bg-card shadow-sm",
                              isEditing ? "p-4" : "p-4",
                              !isEditing && i === 0 && "text-center"
                            )}
                          >
                            {/* Edit trigger — only in view mode */}
                            {!isEditing && (
                              <button
                                onClick={() => startEditSlide(i, slide)}
                                className="absolute right-2 top-2 rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                                title={tCommon("edit")}
                              >
                                <Pencil className="size-3 text-muted-foreground" />
                              </button>
                            )}

                            {/* Slide number */}
                            <p className="mb-1.5 text-[10px] font-medium text-muted-foreground/60">{i + 1}</p>

                            {isEditing && editSlide ? (
                              /* ── Edit mode ── */
                              <div className="space-y-3">
                                <input
                                  className="w-full rounded border bg-background px-2 py-1 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
                                  value={editSlide.title}
                                  onChange={(e) => setEditSlide({ ...editSlide, title: e.target.value })}
                                  placeholder={tStudio("slidedeckEditTitlePlaceholder")}
                                  autoFocus
                                />
                                <div className="space-y-1.5">
                                  {editSlide.bullets.map((b, j) => (
                                    <div key={j} className="flex items-center gap-1.5">
                                      <span className="mt-0.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                                      <input
                                        className="min-w-0 flex-1 rounded border bg-background px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                                        value={b}
                                        onChange={(e) => {
                                          const next = [...editSlide.bullets]
                                          next[j] = e.target.value
                                          setEditSlide({ ...editSlide, bullets: next })
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault()
                                            const next = [...editSlide.bullets]
                                            next.splice(j + 1, 0, "")
                                            setEditSlide({ ...editSlide, bullets: next })
                                          } else if (e.key === "Backspace" && b === "" && editSlide.bullets.length > 1) {
                                            e.preventDefault()
                                            const next = editSlide.bullets.filter((_, k) => k !== j)
                                            setEditSlide({ ...editSlide, bullets: next })
                                          }
                                        }}
                                      />
                                      <button
                                        onClick={() => setEditSlide({ ...editSlide, bullets: editSlide.bullets.filter((_, k) => k !== j) })}
                                        className="shrink-0 rounded p-0.5 hover:bg-muted"
                                        tabIndex={-1}
                                      >
                                        <X className="size-3 text-muted-foreground" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => setEditSlide({ ...editSlide, bullets: [...editSlide.bullets, ""] })}
                                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                  >
                                    <Plus className="size-3" />{tStudio("slidedeckAddBullet")}
                                  </button>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={cancelEditSlide}>{tCommon("cancel")}</Button>
                                  <Button size="sm" className="h-6 text-xs" onClick={() => void saveSlideEdit()}>{tCommon("save")}</Button>
                                </div>
                              </div>
                            ) : (
                              /* ── View mode ── */
                              <>
                                <p className={cn("font-semibold leading-snug", i === 0 ? "text-base" : "mb-2 text-sm")}>
                                  {slide.title}
                                </p>
                                {i === 0
                                  ? slide.bullets.length > 0 && (
                                      <p className="mt-1 text-xs text-muted-foreground">{slide.bullets.join(" · ")}</p>
                                    )
                                  : slide.bullets.length > 0 && (
                                      <ul className="space-y-1.5">
                                        {slide.bullets.map((b, j) => (
                                          <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                                            {b}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                              </>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex shrink-0 gap-2 border-t p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => devTodo("slidedeckFeedback")}
                    >
                      <ThumbsUp className="size-3.5" />
                      {tStudio("slidedeckFeedbackGood")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => devTodo("slidedeckFeedback")}
                    >
                      <ThumbsDown className="size-3.5" />
                      {tStudio("slidedeckFeedbackBad")}
                    </Button>
                  </div>
                </div>
              )
            })()
          ) : activeAudio ? (
            /* ── Audio detail view ── */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-10 shrink-0 items-center justify-between border-b px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={tCommon("back")}
                  onClick={closeAudio}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="truncate px-1 text-xs font-medium">
                  {activeAudio.title ?? tStudio("audio")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  disabled={activeAudio.status === "generating"}
                  onClick={() => generateAudio(undefined, activeAudio.id)}
                >
                  {tStudio("audioRegenerate")}
                </Button>
              </div>
              {activeAudio.status === "generating" || !activeAudio.data ? (
                <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
                  {tStudio("audioGenerating")}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <AudioPlayer
                    outputId={activeAudio.id}
                    data={activeAudio.data as AudioData}
                  />
                </div>
              )}
            </div>
          ) : activeMindmap ? (
            /* ── Mindmap detail view ── */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-10 shrink-0 items-center justify-between border-b px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={tCommon("back")}
                  onClick={closeMindmap}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="truncate px-1 text-xs font-medium">
                  {activeMindmap.title ?? tStudio("mindmap")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  disabled={activeMindmap.status === "generating"}
                  onClick={() => generateMindmap(undefined, activeMindmap.id)}
                >
                  {tStudio("mindmapRegenerate")}
                </Button>
              </div>
              {activeMindmap.status === "generating" || !activeMindmap.data ? (
                <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
                  {tStudio("mindmapGenerating")}
                </div>
              ) : (
                <MindmapCanvas
                  data={activeMindmap.data as MindmapData}
                  onNodeClick={(label, parentLabel) => {
                    const text = parentLabel
                      ? `Discuss what these sources say about ${label}, in the larger context of ${parentLabel}`
                      : `Discuss what these sources say about ${label}`
                    window.dispatchEvent(new CustomEvent("notebook:ask", { detail: { text } }))
                  }}
                />
              )}
            </div>
          ) : activeReport ? (
            /* ── Report detail view ── */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-10 shrink-0 items-center justify-between border-b px-2">
                <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={tCommon("back")} onClick={closeReport}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="truncate px-1 text-xs font-medium">
                  {activeReport.title ?? tStudio("report")}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger className="hover:bg-accent flex size-7 shrink-0 items-center justify-center rounded-md transition-colors">
                    <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="end" className="w-max">
                    <DropdownMenuItem
                      className="whitespace-nowrap"
                      onClick={async () => {
                        const res = await fetch(`/api/studio/report/${activeReport.id}/share`, { method: "POST" })
                        if (!res.ok) { toast.error(tStudio("shareError")); return }
                        const { token } = (await res.json()) as { token: string }
                        const url = `${window.location.origin}/share/${token}`
                        if (navigator.share) await navigator.share({ title: activeReport.title ?? undefined, url }).catch(() => undefined)
                        else { await navigator.clipboard.writeText(url); toast.success(tStudio("shareCopied")) }
                      }}
                    >
                      <Share2 className="size-4" />
                      {tStudio("share")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="whitespace-nowrap"
                      onClick={() => setRenamingOutput(activeReport)}
                    >
                      <Pencil className="size-4" />
                      {tStudio("rename")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="whitespace-nowrap"
                      onClick={() => setReportModalOpen(true)}
                    >
                      <RefreshCw className="size-4" />
                      {tStudio("reportRegenerate")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive whitespace-nowrap"
                      onClick={() => { handleDeleteStudioOutput(activeReport.id); closeReport() }}
                    >
                      <Trash2 className="size-4" />
                      {tStudio("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {activeReport.status === "generating" || !activeReport.data ? (
                <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
                  {tStudio("reportGenerating")}
                </div>
              ) : (
                <ReportView data={activeReport.data as ReportData} />
              )}
            </div>
          ) : activeDatatable ? (
            /* ── Datatable detail view ── */
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-10 shrink-0 items-center justify-between border-b px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={tCommon("back")}
                  onClick={closeDatatable}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="truncate px-1 text-xs font-medium">
                  {activeDatatable.title ?? tStudio("datatable")}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger className="hover:bg-accent flex size-7 shrink-0 items-center justify-center rounded-md transition-colors">
                    <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="end" className="w-max">
                    <DropdownMenuItem
                      className="whitespace-nowrap"
                      onClick={() => setRenamingOutput(activeDatatable)}
                    >
                      <Pencil className="size-4" />
                      {tStudio("rename")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="whitespace-nowrap"
                      disabled={!activeDatatable.data}
                      onClick={() => exportDatatableToSheets()}
                    >
                      <FileDown className="size-4" />
                      {tStudio("datatableExportSheets")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="whitespace-nowrap"
                      onClick={() => setDatatableModal({ view: "customize", output: activeDatatable })}
                    >
                      <History className="size-4" />
                      {tStudio("viewPrompt")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive whitespace-nowrap"
                      onClick={() => {
                        handleDeleteStudioOutput(activeDatatable.id)
                        closeDatatable()
                      }}
                    >
                      <Trash2 className="size-4" />
                      {tStudio("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {activeDatatable.status === "generating" || !activeDatatable.data ? (
                <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
                  {tStudio("datatableGenerating")}
                </div>
              ) : (
                <DatatableView data={activeDatatable.data as DatatableData} />
              )}
            </div>
          ) : activeNote ? (
            /* ── Note detail view ── */
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Sub-header: back + "Aus Chat" badge */}
              <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={closeNoteDetail}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {activeNote.sourceMessageId && (
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium">
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
                  className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("deleteNote")}
                  className="text-muted-foreground hover:text-destructive size-7 shrink-0"
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
                    <span
                      className={`text-xs ${belowMin ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {belowMin ? `${len}/5` : `${len.toLocaleString()}/10.000`}
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
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:brightness-95 dark:hover:brightness-110",
                          tool.bg
                        )}
                        disabled={studioOutputsList.some(
                          (o) => o.type === tool.id && o.status === "generating"
                        )}
                        onClick={() => {
                          if (activeSourceCount === 0) {
                            window.dispatchEvent(new CustomEvent("notebook:ask", {
                              detail: { text: tStudio(tool.labelKey), force: true },
                            }))
                            return
                          }
                          if (tool.id === "quiz") generateQuiz()
                          else if (tool.id === "slidedeck") generateSlidedeck()
                          else if (tool.id === "flashcards") generateFlashcards()
                          else if (tool.id === "mindmap") generateMindmap()
                          else if (tool.id === "audio") generateAudio()
                          else if (tool.id === "datatable") setDatatableModal({ view: "customize", output: null })
                          else if (tool.id === "report") setReportModalOpen(true)
                          else devTodo("unknown-tool")
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={cn("size-4", tool.color)} />
                          <span className="text-xs leading-tight font-medium">
                            {tStudio(tool.labelKey)}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {tool.badge && (
                            <span className="bg-primary/10 text-primary rounded px-1 py-0.5 text-[10px] font-medium">
                              {tool.badge}
                            </span>
                          )}
                          <ChevronRight className="text-muted-foreground size-3" />
                        </div>
                      </button>
                    )
                  })}
                </div>

                <Separator />

                {/* Unified outputs section */}
                <div className="flex flex-col gap-1 p-3">
                  <span className="text-muted-foreground pb-1 text-xs font-medium">
                    {t("outputsTitle")}
                  </span>

                  {outputs.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-xs">
                      {t("noOutputs")}
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {outputs.map((item) => (
                        <li
                          key={item.id}
                          className="group hover:bg-muted flex items-center gap-2 rounded-md px-2 py-2"
                        >
                          {item.loading ? (
                            <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
                          ) : (
                            outputIcon(item.kind)
                          )}
                          <button
                            className="min-w-0 flex-1 text-left"
                            onClick={() => !item.loading && handleOutputClick(item)}
                            disabled={item.loading}
                          >
                            <p className="truncate text-sm">
                              {item.title || (
                                <span className="text-muted-foreground italic">
                                  {t("placeholder")}
                                </span>
                              )}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {relativeTime(item.createdAt, locale)}
                            </p>
                          </button>
                          {!item.loading && (
                            <DropdownMenu>
                              <DropdownMenuTrigger className="hover:bg-muted-foreground/20 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100">
                                <MoreHorizontal className="text-muted-foreground size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="bottom" align="end" className="w-max">
                                {item.kind === "note" ? (
                                  <>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() =>
                                        item.note &&
                                        setNoteAsSource(item.note.title, item.note.content)
                                      }
                                      disabled={!item.note}
                                    >
                                      <BookmarkPlus className="size-4" />
                                      {t("setAsSource")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={handleSetAllAsSource}
                                    >
                                      <Library className="size-4" />
                                      {t("setAllAsSource")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() => item.note && handleExportToDocs(item.note)}
                                      disabled={!item.note}
                                    >
                                      <FileText className="size-4" />
                                      {t("exportToDocs")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() => item.note && handleExportToSheets(item.note)}
                                      disabled={!item.note}
                                    >
                                      <Table2 className="size-4" />
                                      {t("exportToSheets")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive whitespace-nowrap"
                                      onClick={() => handleDeleteNote(item.id)}
                                    >
                                      <Trash2 className="size-4" />
                                      {t("deleteNote")}
                                    </DropdownMenuItem>
                                  </>
                                ) : item.kind === "audio" ? (
                                  <>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={async () => {
                                        const res = await fetch(`/api/studio/audio/${item.id}/share`, { method: "POST" })
                                        if (!res.ok) { toast.error(tStudio("shareError")); return }
                                        const { token } = (await res.json()) as { token: string }
                                        const url = `${window.location.origin}/share/${token}`
                                        if (navigator.share) await navigator.share({ title: item.title, url }).catch(() => undefined)
                                        else { await navigator.clipboard.writeText(url); toast.success(tStudio("shareCopied")) }
                                      }}
                                    >
                                      <Share2 className="size-4" />
                                      {tStudio("share")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() => {
                                        setRenamingOutput(studioOutputsList.find((o) => o.id === item.id) ?? null)
                                        setRenameValue(item.title)
                                      }}
                                    >
                                      <Pencil className="size-4" />
                                      {tStudio("rename")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={async () => {
                                        const res = await fetch(`/api/studio/audio/${item.id}`)
                                        if (!res.ok) return
                                        const { url } = (await res.json()) as { url: string }
                                        const audioRes = await fetch(url)
                                        const blob = await audioRes.blob()
                                        const objectUrl = URL.createObjectURL(blob)
                                        const a = document.createElement("a")
                                        a.href = objectUrl
                                        a.download = `${item.title || "audio"}.mp3`
                                        a.click()
                                        URL.revokeObjectURL(objectUrl)
                                      }}
                                    >
                                      <FileDown className="size-4" />
                                      {tStudio("audioDownload")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() => setAudioModalOutput(studioOutputsList.find((o) => o.id === item.id) ?? null)}
                                    >
                                      <History className="size-4" />
                                      {tStudio("viewPrompt")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive whitespace-nowrap"
                                      onClick={() => handleDeleteStudioOutput(item.id)}
                                    >
                                      <Trash2 className="size-4" />
                                      {tStudio("delete")}
                                    </DropdownMenuItem>
                                  </>
                                ) : item.kind === "slidedeck" ? (
                                  <>
                                    {(() => {
                                      const output = studioOutputsList.find((o) => o.id === item.id)
                                      const url = (output?.data as { slidesUrl?: string } | null)
                                        ?.slidesUrl
                                      return (
                                        <>
                                          <DropdownMenuItem
                                            className="whitespace-nowrap"
                                            onClick={() => {
                                              const o = studioOutputsList.find(
                                                (x) => x.id === item.id
                                              )
                                              if (url)
                                                window.open(url, "_blank", "noopener,noreferrer")
                                              else if (o?.data && o.status === "ready")
                                                void createGoogleSlidesForOutput(o)
                                              else toast.error(tStudio("slidedeckNoUrl"))
                                            }}
                                          >
                                            <ExternalLink className="size-4" />
                                            {tStudio("slidedeckOpen")}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="whitespace-nowrap"
                                            onClick={async () => {
                                              if (url) {
                                                if (navigator.share) {
                                                  await navigator
                                                    .share({ title: item.title, url })
                                                    .catch(() => undefined)
                                                } else {
                                                  await navigator.clipboard.writeText(url)
                                                  toast.success(tStudio("shareCopied"))
                                                }
                                              } else toast.error(tStudio("slidedeckNoUrl"))
                                            }}
                                          >
                                            <Share2 className="size-4" />
                                            {tStudio("share")}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="whitespace-nowrap"
                                            onClick={() => {
                                              setRenamingOutput(
                                                studioOutputsList.find((o) => o.id === item.id) ??
                                                  null
                                              )
                                              setRenameValue(item.title)
                                            }}
                                          >
                                            <Pencil className="size-4" />
                                            {tStudio("rename")}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="whitespace-nowrap"
                                            onClick={() => {
                                              if (url)
                                                window.open(
                                                  slidesUrlToExportUrl(url, "pdf"),
                                                  "_blank",
                                                  "noopener,noreferrer"
                                                )
                                              else toast.error(tStudio("slidedeckNoUrl"))
                                            }}
                                          >
                                            <FileDown className="size-4" />
                                            {tStudio("slidedeckExportPdf")}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="whitespace-nowrap"
                                            onClick={() => {
                                              if (url)
                                                window.open(
                                                  slidesUrlToExportUrl(url, "pptx"),
                                                  "_blank",
                                                  "noopener,noreferrer"
                                                )
                                              else toast.error(tStudio("slidedeckNoUrl"))
                                            }}
                                          >
                                            <FileDown className="size-4" />
                                            {tStudio("slidedeckExportPptx")}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="whitespace-nowrap"
                                            onClick={() => {
                                              if (url)
                                                window.open(
                                                  slidesUrlToExportUrl(url, "present"),
                                                  "_blank",
                                                  "noopener,noreferrer"
                                                )
                                              else toast.error(tStudio("slidedeckNoUrl"))
                                            }}
                                          >
                                            <Play className="size-4" />
                                            {tStudio("slidedeckPresent")}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="whitespace-nowrap"
                                            onClick={() => {
                                              const o = studioOutputsList.find((x) => x.id === item.id)
                                              if (o) { openSlidedeck(o); setRevisionModalOpen(true) }
                                            }}
                                          >
                                            <RefreshCw className="size-4" />
                                            {tStudio("slidedeckRevise")}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="whitespace-nowrap"
                                            onClick={() => {
                                              setSlidedeckModalView("sources")
                                              setSlidedeckModalOutput(
                                                studioOutputsList.find((o) => o.id === item.id) ??
                                                  null
                                              )
                                            }}
                                          >
                                            <History className="size-4" />
                                            {tStudio("viewPrompt")}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive whitespace-nowrap"
                                            onClick={() => handleDeleteStudioOutput(item.id)}
                                          >
                                            <Trash2 className="size-4" />
                                            {tStudio("delete")}
                                          </DropdownMenuItem>
                                        </>
                                      )
                                    })()}
                                  </>
                                ) : item.kind === "mindmap" ? (
                                  <>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={async () => {
                                        const res = await fetch(`/api/studio/mindmap/${item.id}/share`, { method: "POST" })
                                        if (!res.ok) { toast.error(tStudio("shareError")); return }
                                        const { token } = (await res.json()) as { token: string }
                                        const url = `${window.location.origin}/share/${token}`
                                        if (navigator.share) {
                                          await navigator.share({ title: item.title, url }).catch(() => undefined)
                                        } else {
                                          await navigator.clipboard.writeText(url)
                                          toast.success(tStudio("shareCopied"))
                                        }
                                      }}
                                    >
                                      <Share2 className="size-4" />
                                      {tStudio("share")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() => {
                                        setRenamingOutput(studioOutputsList.find((o) => o.id === item.id) ?? null)
                                        setRenameValue(item.title)
                                      }}
                                    >
                                      <Pencil className="size-4" />
                                      {tStudio("rename")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() =>
                                        setMindmapModalOutput(studioOutputsList.find((o) => o.id === item.id) ?? null)
                                      }
                                    >
                                      <History className="size-4" />
                                      {tStudio("viewPrompt")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive whitespace-nowrap"
                                      onClick={() => handleDeleteStudioOutput(item.id)}
                                    >
                                      <Trash2 className="size-4" />
                                      {tStudio("delete")}
                                    </DropdownMenuItem>
                                  </>
                                ) : item.kind === "flashcards" ? (
                                  <>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={async () => {
                                        const res = await fetch(
                                          `/api/studio/flashcards/${item.id}/share`,
                                          { method: "POST" }
                                        )
                                        if (!res.ok) {
                                          toast.error(tStudio("shareError"))
                                          return
                                        }
                                        const { token } = (await res.json()) as { token: string }
                                        const url = `${window.location.origin}/share/${token}`
                                        if (navigator.share) {
                                          await navigator
                                            .share({ title: item.title, url })
                                            .catch(() => undefined)
                                        } else {
                                          await navigator.clipboard.writeText(url)
                                          toast.success(tStudio("shareCopied"))
                                        }
                                      }}
                                    >
                                      <Share2 className="size-4" />
                                      {tStudio("share")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() => {
                                        setRenamingOutput(
                                          studioOutputsList.find((o) => o.id === item.id) ?? null
                                        )
                                        setRenameValue(item.title)
                                      }}
                                    >
                                      <Pencil className="size-4" />
                                      {tStudio("rename")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() =>
                                        setFlashcardsModalOutput(
                                          studioOutputsList.find((o) => o.id === item.id) ?? null
                                        )
                                      }
                                    >
                                      <History className="size-4" />
                                      {tStudio("viewPrompt")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive whitespace-nowrap"
                                      onClick={() => handleDeleteStudioOutput(item.id)}
                                    >
                                      <Trash2 className="size-4" />
                                      {tStudio("delete")}
                                    </DropdownMenuItem>
                                  </>
                                ) : item.kind === "datatable" ? (
                                  <>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={async () => {
                                        const res = await fetch(`/api/studio/datatable/${item.id}/share`, { method: "POST" })
                                        if (!res.ok) { toast.error(tStudio("shareError")); return }
                                        const { token } = (await res.json()) as { token: string }
                                        const url = `${window.location.origin}/share/${token}`
                                        if (navigator.share) await navigator.share({ title: item.title, url }).catch(() => undefined)
                                        else { await navigator.clipboard.writeText(url); toast.success(tStudio("shareCopied")) }
                                      }}
                                    >
                                      <Share2 className="size-4" />
                                      {tStudio("share")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() => {
                                        setRenamingOutput(studioOutputsList.find((o) => o.id === item.id) ?? null)
                                        setRenameValue(item.title)
                                      }}
                                    >
                                      <Pencil className="size-4" />
                                      {tStudio("rename")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() =>
                                        setDatatableSourcesOutput(studioOutputsList.find((o) => o.id === item.id) ?? null)
                                      }
                                    >
                                      <History className="size-4" />
                                      {tStudio("viewPrompt")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive whitespace-nowrap"
                                      onClick={() => handleDeleteStudioOutput(item.id)}
                                    >
                                      <Trash2 className="size-4" />
                                      {tStudio("delete")}
                                    </DropdownMenuItem>
                                  </>
                                ) : item.kind === "report" ? (
                                  <>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={async () => {
                                        const res = await fetch(`/api/studio/report/${item.id}/share`, { method: "POST" })
                                        if (!res.ok) { toast.error(tStudio("shareError")); return }
                                        const { token } = (await res.json()) as { token: string }
                                        const url = `${window.location.origin}/share/${token}`
                                        if (navigator.share) await navigator.share({ title: item.title, url }).catch(() => undefined)
                                        else { await navigator.clipboard.writeText(url); toast.success(tStudio("shareCopied")) }
                                      }}
                                    >
                                      <Share2 className="size-4" />
                                      {tStudio("share")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() => {
                                        setRenamingOutput(studioOutputsList.find((o) => o.id === item.id) ?? null)
                                        setRenameValue(item.title)
                                      }}
                                    >
                                      <Pencil className="size-4" />
                                      {tStudio("rename")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive whitespace-nowrap"
                                      onClick={() => handleDeleteStudioOutput(item.id)}
                                    >
                                      <Trash2 className="size-4" />
                                      {tStudio("delete")}
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={async () => {
                                        const res = await fetch(
                                          `/api/studio/quiz/${item.id}/share`,
                                          { method: "POST" }
                                        )
                                        if (!res.ok) {
                                          toast.error(tStudio("shareError"))
                                          return
                                        }
                                        const { token } = (await res.json()) as { token: string }
                                        const url = `${window.location.origin}/share/${token}`
                                        if (navigator.share) {
                                          await navigator
                                            .share({ title: item.title, url })
                                            .catch(() => undefined)
                                        } else {
                                          await navigator.clipboard.writeText(url)
                                          toast.success(tStudio("shareCopied"))
                                        }
                                      }}
                                    >
                                      <Share2 className="size-4" />
                                      {tStudio("share")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() => {
                                        setRenamingOutput(
                                          studioOutputsList.find((o) => o.id === item.id) ?? null
                                        )
                                        setRenameValue(item.title)
                                      }}
                                    >
                                      <Pencil className="size-4" />
                                      {tStudio("rename")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="whitespace-nowrap"
                                      onClick={() =>
                                        setSourcesModalOutput(
                                          studioOutputsList.find((o) => o.id === item.id) ?? null
                                        )
                                      }
                                    >
                                      <History className="size-4" />
                                      {tStudio("viewPrompt")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive whitespace-nowrap"
                                      onClick={() => handleDeleteStudioOutput(item.id)}
                                    >
                                      <Trash2 className="size-4" />
                                      {tStudio("delete")}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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
                  className="bg-card hover:bg-muted flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-md transition-colors"
                >
                  <StickyNote className="text-muted-foreground size-4" />
                  {t("addNote")}
                </button>
              </div>
            </div>
          ))}
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
            <Button variant="outline" onClick={() => setRenamingOutput(null)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleRenameStudioOutput} disabled={!renameValue.trim()}>
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <QuizSourcesModal
        open={!!sourcesModalOutput}
        onOpenChange={(open) => !open && setSourcesModalOutput(null)}
        usedSources={
          ((sourcesModalOutput?.data as QuizData)?.usedSources ?? []) as QuizUsedSource[]
        }
        onGenerate={({ count, difficulty, focusTopic }) =>
          generateQuiz(focusTopic, sourcesModalOutput?.id, count, difficulty)
        }
      />
      <FlashcardCustomizeModal
        open={!!flashcardsModalOutput}
        onOpenChange={(open) => !open && setFlashcardsModalOutput(null)}
        usedSources={
          ((flashcardsModalOutput?.data as FlashcardData)?.usedSources ??
            []) as FlashcardUsedSource[]
        }
        onGenerate={({ count, difficulty, focusTopic }) =>
          generateFlashcards(focusTopic, flashcardsModalOutput?.id, count, difficulty)
        }
      />
      <SlidedeckModal
        open={!!slidedeckModalOutput}
        onOpenChange={(open) => !open && setSlidedeckModalOutput(null)}
        usedSources={
          (slidedeckModalOutput?.data as { usedSources?: SlidedeckUsedSource[] })?.usedSources ?? []
        }
        defaultLanguage={(slidedeckModalOutput?.data as { language?: string })?.language ?? "de"}
        initialView={slidedeckModalView}
        onGenerate={(params) => generateSlidedeck(params, slidedeckModalOutput?.id)}
      />
      {slideViewerOpen && activeSlidedeck?.data && (
        <SlidedeckViewer
          slideData={activeSlidedeck.data as SlideData}
          currentIndex={slideViewerIndex}
          onIndexChange={setSlideViewerIndex}
          onClose={() => setSlideViewerOpen(false)}
        />
      )}
      {revisionModalOpen && activeSlidedeck?.data && (
        <SlidedeckRevisionModal
          slideData={activeSlidedeck.data as SlideData & { usedSources?: SlidedeckUsedSource[]; language?: string; slidesUrl?: string }}
          presentationTitle={(activeSlidedeck.data as SlideData).presentationTitle ?? activeSlidedeck.title ?? tStudio("slidedeck")}
          isRevising={isRevising}
          onClose={() => setRevisionModalOpen(false)}
          onRevise={(instructions) => void handleRevise(instructions)}
          onStartViewer={() => { setSlideViewerIndex(0); setSlideViewerOpen(true) }}
        />
      )}
      <MindmapSourcesModal
        open={!!mindmapModalOutput}
        onOpenChange={(open) => !open && setMindmapModalOutput(null)}
        usedSources={((mindmapModalOutput?.data as MindmapData)?.usedSources ?? []) as MindmapData["usedSources"]}
        onGenerate={(focusTopic) => generateMindmap(focusTopic, mindmapModalOutput?.id)}
      />
      <AudioSourcesModal
        open={!!audioModalOutput}
        onOpenChange={(open) => !open && setAudioModalOutput(null)}
        usedSources={((audioModalOutput?.data as AudioData)?.usedSources ?? [])}
        currentFormat={(audioModalOutput?.data as AudioData)?.format}
        currentLanguage={(audioModalOutput?.data as AudioData)?.language}
        currentLength={(audioModalOutput?.data as AudioData)?.length}
        onGenerate={(params) => generateAudio(params, audioModalOutput?.id)}
      />
      <DatatableCustomizeModal
        key={datatableModal ? `${datatableModal.view}-${datatableModal.output?.id ?? "new"}` : "closed"}
        open={!!datatableModal}
        onOpenChange={(open) => { if (!open) setDatatableModal(null) }}
        usedSources={(datatableModal?.output?.data as DatatableData | null)?.usedSources ?? []}
        initialView={datatableModal?.view ?? "customize"}
        defaultLanguage={(datatableModal?.output?.data as DatatableData | null)?.language ?? "de"}
        onGenerate={(options) => generateDatatable(options, datatableModal?.output?.id)}
      />
      <DatatableSourcesModal
        key={datatableSourcesOutput?.id ?? "datatable-sources-closed"}
        open={!!datatableSourcesOutput}
        onOpenChange={(open) => { if (!open) setDatatableSourcesOutput(null) }}
        usedSources={(datatableSourcesOutput?.data as DatatableData | null)?.usedSources ?? []}
        defaultLanguage={(datatableSourcesOutput?.data as DatatableData | null)?.language ?? "de"}
        onGenerate={(options) => generateDatatable(options, datatableSourcesOutput?.id)}
      />
      <ReportFormatModal
        open={reportModalOpen}
        notebookId={notebookId}
        defaultLanguage="de"
        onClose={() => setReportModalOpen(false)}
        onGenerate={(format, language, customPrompt) =>
          generateReport(format, language, customPrompt, activeReport?.id)
        }
      />
    </>
  )
}
