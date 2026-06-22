"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Pencil, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type ReportSuggestion = { title: string; description: string }

type FixedFormat = { id: string; titleKey: string; descKey: string }

const FIXED_FORMATS: FixedFormat[] = [
  { id: "overview", titleKey: "formatOverviewTitle", descKey: "formatOverviewDesc" },
  { id: "studyplan", titleKey: "formatStudyplanTitle", descKey: "formatStudyplanDesc" },
  { id: "blogpost", titleKey: "formatBlogpostTitle", descKey: "formatBlogpostDesc" },
]

const LANGUAGES = [
  { value: "de", labelKey: "langDe" },
  { value: "en", labelKey: "langEn" },
  { value: "fr", labelKey: "langFr" },
  { value: "es", labelKey: "langEs" },
  { value: "it", labelKey: "langIt" },
]

type ConfigState = {
  formatId: string
  formatTitle: string
  formatDesc: string
  showCard: boolean
}

export function ReportFormatModal({
  open,
  notebookId,
  defaultLanguage,
  onClose,
  onGenerate,
}: {
  open: boolean
  notebookId: string
  defaultLanguage: string
  onClose: () => void
  onGenerate: (format: string, language: string, customPrompt?: string) => void
}) {
  const t = useTranslations("report")
  const [view, setView] = useState<"formats" | "config">("formats")
  const [config, setConfig] = useState<ConfigState | null>(null)
  const [language, setLanguage] = useState(defaultLanguage)
  const [customPrompt, setCustomPrompt] = useState("")
  const [suggestions, setSuggestions] = useState<ReportSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  useEffect(() => {
    if (!open) return
    setView("formats")
    setConfig(null)
    setCustomPrompt("")
    setLanguage(defaultLanguage)
    setSuggestions([])
    setLoadingSuggestions(true)

    fetch(`/api/studio/report/suggestions?notebookId=${encodeURIComponent(notebookId)}`)
      .then((r) => r.json())
      .then((data: { suggestions: ReportSuggestion[] }) => setSuggestions(data.suggestions ?? []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false))
  }, [open, notebookId, defaultLanguage])

  function openConfig(
    formatId: string,
    formatTitle: string,
    formatDesc: string,
    showCard: boolean
  ) {
    setConfig({ formatId, formatTitle, formatDesc, showCard })
    setView("config")
  }

  function handleGenerate() {
    if (!config) return
    onGenerate(config.formatId, language, customPrompt.trim() || undefined)
    onClose()
  }

  function handleGenerateDirect(formatId: string) {
    onGenerate(formatId, language)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        {view === "formats" ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("modalTitle")}</DialogTitle>
            </DialogHeader>

            {/* Custom report card */}
            <button
              onClick={() =>
                openConfig("custom", t("formatCustomTitle"), t("formatCustomDesc"), false)
              }
              className="border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/60 flex w-full flex-col items-start gap-1 rounded-xl border-2 border-dashed p-4 text-left transition-colors"
            >
              <span className="text-sm font-semibold">{t("formatCustomTitle")}</span>
              <span className="text-muted-foreground text-xs">{t("formatCustomDesc")}</span>
            </button>

            {/* Fixed formats */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {FIXED_FORMATS.map((fmt) => (
                <FormatCard
                  key={fmt.id}
                  title={t(fmt.titleKey as Parameters<typeof t>[0])}
                  description={t(fmt.descKey as Parameters<typeof t>[0])}
                  onCardClick={() => handleGenerateDirect(fmt.id)}
                  onPencilClick={() =>
                    openConfig(
                      fmt.id,
                      t(fmt.titleKey as Parameters<typeof t>[0]),
                      t(fmt.descKey as Parameters<typeof t>[0]),
                      true
                    )
                  }
                />
              ))}
            </div>

            {/* Suggestions */}
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                {t("suggestionsTitle")}
              </p>
              {loadingSuggestions ? (
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="bg-muted/30 h-16 animate-pulse rounded-xl border" />
                  ))}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {suggestions.map((s) => (
                    <FormatCard
                      key={s.title}
                      title={s.title}
                      description={s.description}
                      onCardClick={() => handleGenerateDirect(s.title)}
                      onPencilClick={() => openConfig(s.title, s.title, s.description, true)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">{t("suggestionsEmpty")}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView("formats")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t("back")}
                >
                  <X className="size-4" />
                </button>
                <DialogTitle>{t("configTitle")}</DialogTitle>
              </div>
            </DialogHeader>

            {/* Format card preview (only when opened via pencil) */}
            {config?.showCard && (
              <div className="bg-muted/30 rounded-xl border p-3">
                <p className="text-sm font-semibold">{config.formatTitle}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">{config.formatDesc}</p>
              </div>
            )}

            {/* Language */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t("languageLabel")}</label>
              <select
                value={language}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLanguage(e.target.value)}
                className="border-input bg-background focus:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-sm focus:ring-1 focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {t(l.labelKey as Parameters<typeof t>[0])}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom prompt */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t("promptLabel")}</label>
              <textarea
                value={customPrompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setCustomPrompt(e.target.value)
                }
                placeholder={t("promptPlaceholder")}
                className="border-input bg-background focus:ring-ring min-h-24 w-full resize-none rounded-md border px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleGenerate}>{t("generate")}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormatCard({
  title,
  description,
  onCardClick,
  onPencilClick,
}: {
  title: string
  description: string
  onCardClick: () => void
  onPencilClick: () => void
}) {
  return (
    <div className="group bg-card hover:border-primary/40 hover:bg-muted/40 relative flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors">
      <button className="flex flex-col gap-1 text-left" onClick={onCardClick}>
        <span className="pr-6 text-sm leading-tight font-semibold">{title}</span>
        <span className="text-muted-foreground text-xs leading-snug">{description}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onPencilClick()
        }}
        className={cn(
          "text-muted-foreground absolute top-2 right-2 flex size-6 items-center justify-center rounded-md transition-colors",
          "hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100"
        )}
        aria-label="Anpassen"
      >
        <Pencil className="size-3" />
      </button>
    </div>
  )
}
