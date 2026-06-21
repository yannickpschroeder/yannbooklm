"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RefreshCw, FileText, Globe, AlignLeft } from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import { cn } from "@/lib/utils"
import type { QuizUsedSource } from "./quiz-view"

type View = "sources" | "customize"
type Difficulty = "einfach" | "mittel" | "schwierig"

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="size-3.5 text-red-500" />,
  url: <Globe className="size-3.5 text-blue-500" />,
  youtube: <FaYoutube className="size-3.5 text-red-500" />,
  text: <AlignLeft className="size-3.5 text-blue-400" />,
}

const COUNT_OPTIONS = [
  { label: "Weniger", value: 10 },
  { label: "Standard (Standardeinstellung)", value: 15 },
  { label: "Mehr", value: 25 },
] as const

const DIFFICULTY_OPTIONS = [
  { label: "Einfach", value: "einfach" as Difficulty },
  { label: "Mittel (Standardeinstellung)", value: "mittel" as Difficulty },
  { label: "Schwierig", value: "schwierig" as Difficulty },
] as const

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  usedSources: QuizUsedSource[]
  onGenerate: (params: { count: number; difficulty: Difficulty; focusTopic?: string }) => void
}

export function QuizSourcesModal({ open, onOpenChange, usedSources, onGenerate }: Props) {
  const [view, setView] = useState<View>("sources")
  const [count, setCount] = useState<number>(15)
  const [difficulty, setDifficulty] = useState<Difficulty>("mittel")
  const [focusTopic, setFocusTopic] = useState("")

  function handleGenerate() {
    onOpenChange(false)
    onGenerate({ count, difficulty, focusTopic: focusTopic.trim() || undefined })
    setView("sources")
  }

  function handleOpenChange(val: boolean) {
    if (!val) setView("sources")
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {view === "sources" ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <FileText className="size-4" />
                <DialogTitle>Quellen</DialogTitle>
                <button
                  onClick={() => setView("customize")}
                  className="ml-auto rounded-md p-1 hover:bg-muted"
                  aria-label="Quiz anpassen"
                >
                  <RefreshCw className="size-4" />
                </button>
              </div>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 py-2">
              {usedSources.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Quellen gespeichert.</p>
              ) : (
                usedSources.map((s) => (
                  <span
                    key={s.id}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs"
                  >
                    {SOURCE_ICONS[s.type] ?? <FileText className="size-3.5" />}
                    {s.title}
                  </span>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Quiz anpassen</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-5 py-2">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="mb-2 text-sm font-medium">Anzahl der Fragen</p>
                  <div className="flex flex-col gap-2">
                    {COUNT_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setCount(o.value)}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                          count === o.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {count === o.value && <span>✓</span>}
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Schwierigkeitsgrad</p>
                  <div className="flex flex-col gap-2">
                    {DIFFICULTY_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setDifficulty(o.value)}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                          difficulty === o.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {difficulty === o.value && <span>✓</span>}
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Was soll das Thema sein?</p>
                <textarea
                  value={focusTopic}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFocusTopic(e.target.value)}
                  placeholder={`Vorschläge\n• Erstelle mir ein Quiz, mit dem ich für meinen Geschichtstest über das Alte Ägypten lernen kann\n• Das Quiz muss 30 Fragen enthalten (maximal 50 Fragen sind erlaubt)\n• Das Quiz muss auf eine bestimmte Quelle beschränkt sein (z. B. „der Artikel über Italien")\n• Das Quiz muss sich ausschließlich auf die wichtigsten Konzepte der Physik konzentrieren`}
                  className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleGenerate}>Generieren</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
