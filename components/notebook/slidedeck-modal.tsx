"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check, FileText, Globe, AlignLeft } from "lucide-react"
import { FaYoutube, FaSlideshare } from "react-icons/fa"
import { cn } from "@/lib/utils"
import { openSourceById } from "@/lib/source-view-event"

export type SlidedeckUsedSource = { id: string; title: string; type: string }

type View = "sources" | "customize"
type SlideFormat = "detailed" | "presenter"
type SlideLength = "short" | "standard"

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="size-3.5 text-red-500" />,
  url: <Globe className="size-3.5 text-blue-500" />,
  youtube: <FaYoutube className="size-3.5 text-red-500" />,
  text: <AlignLeft className="size-3.5 text-blue-400" />,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  usedSources: SlidedeckUsedSource[]
  defaultLanguage?: string
  initialView?: View
  onGenerate: (params: {
    format: SlideFormat
    length: SlideLength
    language: string
    focusTopic?: string
  }) => void
}

export function SlidedeckModal({ open, onOpenChange, usedSources, defaultLanguage = "de", initialView = "sources", onGenerate }: Props) {
  const t = useTranslations("slidedeck")
  const [view, setView] = useState<View>(initialView)
  const [format, setFormat] = useState<SlideFormat>("detailed")
  const [length, setLength] = useState<SlideLength>("standard")
  const [language, setLanguage] = useState(defaultLanguage)
  const [focusTopic, setFocusTopic] = useState("")

  const languageOptions = [
    { label: t("langDe"), value: "de" },
    { label: t("langEn"), value: "en" },
    { label: t("langFr"), value: "fr" },
    { label: t("langEs"), value: "es" },
    { label: t("langIt"), value: "it" },
    { label: t("langPt"), value: "pt" },
    { label: t("langNl"), value: "nl" },
    { label: t("langPl"), value: "pl" },
  ]

  function handleGenerate() {
    onOpenChange(false)
    onGenerate({ format, length, language, focusTopic: focusTopic.trim() || undefined })
    setView("sources")
  }

  function handleOpenChange(val: boolean) {
    if (!val) setView(initialView)
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {view === "sources" ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <FaSlideshare className="size-4 text-orange-400" />
                <DialogTitle>{t("sourcesTitle")}</DialogTitle>
              </div>
              <button
                onClick={() => setView("customize")}
                className="absolute right-12 top-4 rounded-sm p-1 opacity-70 hover:opacity-100 hover:bg-muted"
                aria-label={t("customizeAria")}
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
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

              {/* Format */}
              <div>
                <p className="mb-2 text-sm font-medium">{t("formatLabel")}</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormat("detailed")}
                    className={cn(
                      "relative flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors",
                      format === "detailed" ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                    )}
                  >
                    {format === "detailed" && <Check className="absolute right-2 top-2 size-3.5 text-primary" />}
                    <span className="font-medium">{t("formatDetailed")}</span>
                    <span className="text-xs text-muted-foreground">{t("formatDetailedDesc")}</span>
                  </button>
                  <button
                    onClick={() => setFormat("presenter")}
                    className={cn(
                      "relative flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors",
                      format === "presenter" ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                    )}
                  >
                    {format === "presenter" && <Check className="absolute right-2 top-2 size-3.5 text-primary" />}
                    <span className="font-medium">{t("formatPresenter")}</span>
                    <span className="text-xs text-muted-foreground">{t("formatPresenterDesc")}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Language */}
                <div>
                  <p className="mb-2 text-sm font-medium">{t("languageLabel")}</p>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    {languageOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Length */}
                <div>
                  <p className="mb-2 text-sm font-medium">{t("lengthLabel")}</p>
                  <div className="flex flex-col items-start gap-2">
                    {([
                      { label: t("lengthShort"),    value: "short"    as SlideLength },
                      { label: t("lengthStandard"), value: "standard" as SlideLength },
                    ]).map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setLength(o.value)}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                          length === o.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {length === o.value && <span>✓</span>}
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Focus topic */}
              <div>
                <p className="mb-2 text-sm font-medium">{t("topicLabel")}</p>
                <textarea
                  value={focusTopic}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFocusTopic(e.target.value)}
                  placeholder={t("topicPlaceholder")}
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleGenerate}>{t("create")}</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
