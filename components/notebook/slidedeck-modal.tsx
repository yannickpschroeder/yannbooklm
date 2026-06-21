"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check, FileText, Globe, AlignLeft, RefreshCw } from "lucide-react"
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

export function SlidedeckModal({
  open,
  onOpenChange,
  usedSources,
  defaultLanguage = "de",
  initialView = "sources",
  onGenerate,
}: Props) {
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
                className="hover:bg-muted absolute top-4 right-12 -mt-[6px] -mr-[8px] h-[26px] w-[26px] rounded-sm p-1 opacity-70 hover:opacity-100"
                aria-label={t("customizeAria")}
              >
                <RefreshCw className="size-4" />
              </button>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 py-2">
              {usedSources.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("noSources")}</p>
              ) : (
                usedSources.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onOpenChange(false)
                      openSourceById(s.id)
                    }}
                    className="border-border bg-muted/50 hover:bg-muted flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
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
                      format === "detailed"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    {format === "detailed" && (
                      <Check className="text-primary absolute top-2 right-2 size-3.5" />
                    )}
                    <span className="font-medium">{t("formatDetailed")}</span>
                    <span className="text-muted-foreground text-xs">{t("formatDetailedDesc")}</span>
                  </button>
                  <button
                    onClick={() => setFormat("presenter")}
                    className={cn(
                      "relative flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors",
                      format === "presenter"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    {format === "presenter" && (
                      <Check className="text-primary absolute top-2 right-2 size-3.5" />
                    )}
                    <span className="font-medium">{t("formatPresenter")}</span>
                    <span className="text-muted-foreground text-xs">
                      {t("formatPresenterDesc")}
                    </span>
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
                    className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
                  >
                    {languageOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Length */}
                <div>
                  <p className="mb-2 text-sm font-medium">{t("lengthLabel")}</p>
                  <div className="flex flex-col items-start gap-2">
                    {[
                      { label: t("lengthShort"), value: "short" as SlideLength },
                      { label: t("lengthStandard"), value: "standard" as SlideLength },
                    ].map((o) => (
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
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFocusTopic(e.target.value)
                  }
                  placeholder={t("topicPlaceholder")}
                  className="border-input bg-background focus:ring-ring min-h-24 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
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
