"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RefreshCw, FileText, Globe, AlignLeft } from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import { cn } from "@/lib/utils"
import { openSourceById } from "@/lib/source-view-event"
import type { QuizUsedSource } from "./quiz-view"

type View = "sources" | "customize"
type Difficulty = "einfach" | "mittel" | "schwierig"

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="size-3.5 text-red-500" />,
  url: <Globe className="size-3.5 text-blue-500" />,
  youtube: <FaYoutube className="size-3.5 text-red-500" />,
  text: <AlignLeft className="size-3.5 text-blue-400" />,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  usedSources: QuizUsedSource[]
  onGenerate: (params: { count: number; difficulty: Difficulty; focusTopic?: string }) => void
}

export function QuizSourcesModal({ open, onOpenChange, usedSources, onGenerate }: Props) {
  const t = useTranslations("quiz")
  const [view, setView] = useState<View>("sources")
  const [count, setCount] = useState<number>(15)
  const [difficulty, setDifficulty] = useState<Difficulty>("mittel")
  const [focusTopic, setFocusTopic] = useState("")

  const countOptions = [
    { label: t("countFew"),      value: 10 },
    { label: t("countStandard"), value: 15 },
    { label: t("countMany"),     value: 25 },
  ]

  const difficultyOptions = [
    { label: t("diffEasy"),   value: "einfach"   as Difficulty },
    { label: t("diffMedium"), value: "mittel"    as Difficulty },
    { label: t("diffHard"),   value: "schwierig" as Difficulty },
  ]

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
      <DialogContent className="sm:max-w-2xl">
        {view === "sources" ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <FileText className="size-4" />
                <DialogTitle>{t("sourcesTitle")}</DialogTitle>
              </div>
              <button
                onClick={() => setView("customize")}
                className="absolute right-12 top-4 rounded-sm p-1 opacity-70 hover:opacity-100 hover:bg-muted"
                aria-label={t("customizeAria")}
              >
                <RefreshCw className="size-4" />
              </button>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 py-2">
              {usedSources.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noSources")}</p>
              ) : (
                usedSources.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { onOpenChange(false); openSourceById(s.id) }}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs hover:bg-muted transition-colors"
                  >
                    {SOURCE_ICONS[s.type] ?? <FileText className="size-3.5" />}
                    {s.title}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("customizeTitle")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-5 py-2">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="mb-2 text-sm font-medium">{t("countLabel")}</p>
                  <div className="flex flex-col items-start gap-2">
                    {countOptions.map((o) => (
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
                  <p className="mb-2 text-sm font-medium">{t("difficultyLabel")}</p>
                  <div className="flex flex-col items-start gap-2">
                    {difficultyOptions.map((o) => (
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
                <p className="mb-2 text-sm font-medium">{t("topicLabel")}</p>
                <textarea
                  value={focusTopic}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFocusTopic(e.target.value)}
                  placeholder={t("topicPlaceholder")}
                  className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleGenerate}>{t("generate")}</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
