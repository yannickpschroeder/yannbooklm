"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RefreshCw, FileText, Globe, AlignLeft } from "lucide-react"
import { FaTable, FaYoutube } from "react-icons/fa"
import { openSourceById } from "@/lib/source-view-event"

type View = "sources" | "customize"

type UsedSource = { id: string; title: string; type: string }

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="size-3.5 text-red-500" />,
  url: <Globe className="size-3.5 text-blue-500" />,
  youtube: <FaYoutube className="size-3.5 text-red-500" />,
  text: <AlignLeft className="size-3.5 text-blue-400" />,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  usedSources: UsedSource[]
  initialView?: View
  defaultLanguage?: string
  onGenerate: (options: { language: string; focusTopic?: string }) => void
}

export function DatatableCustomizeModal({
  open,
  onOpenChange,
  usedSources,
  initialView = "customize",
  defaultLanguage = "de",
  onGenerate,
}: Props) {
  const t = useTranslations("studio")
  const tSlide = useTranslations("slidedeck")
  const [view, setView] = useState<View>(initialView)
  const [language, setLanguage] = useState(defaultLanguage)
  const [focusTopic, setFocusTopic] = useState("")

  const languageOptions = [
    { label: tSlide("langDe"), value: "de" },
    { label: tSlide("langEn"), value: "en" },
    { label: tSlide("langFr"), value: "fr" },
    { label: tSlide("langEs"), value: "es" },
    { label: tSlide("langIt"), value: "it" },
    { label: tSlide("langPt"), value: "pt" },
    { label: tSlide("langNl"), value: "nl" },
    { label: tSlide("langPl"), value: "pl" },
  ]

  function handleGenerate() {
    onOpenChange(false)
    onGenerate({ language, focusTopic: focusTopic.trim() || undefined })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {view === "sources" ? (
          <>
            <DialogHeader className="flex-row items-center justify-between pr-8">
              <div className="flex items-center gap-2">
                <FaTable className="size-4 text-sky-400" />
                <DialogTitle>{t("datatableSourcesTitle")}</DialogTitle>
              </div>
              <button
                onClick={() => setView("customize")}
                className="hover:bg-muted -mt-[6px] -mr-[8px] h-[26px] w-[26px] rounded-sm p-1 opacity-70 hover:opacity-100"
                aria-label={t("datatableCustomizeAria")}
              >
                <RefreshCw className="size-4" />
              </button>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 py-2">
              {usedSources.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("datatableNoSourcesSaved")}</p>
              ) : (
                usedSources.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onOpenChange(false)
                      openSourceById(s.id)
                    }}
                    className="bg-muted/50 hover:bg-muted flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
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
              <div className="flex items-center gap-2">
                <FaTable className="size-4 text-sky-400" />
                <DialogTitle>{t("datatableCustomizeTitle")}</DialogTitle>
              </div>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div>
                <p className="mb-2 text-sm font-medium">{t("datatableLanguageLabel")}</p>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="focus:ring-ring border-input bg-background w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
                >
                  {languageOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">{t("datatableDescriptionLabel")}</p>
                <textarea
                  value={focusTopic}
                  onChange={(e) => setFocusTopic(e.target.value)}
                  placeholder={t("datatableDescriptionPlaceholder")}
                  className="focus:ring-ring border-input bg-background min-h-32 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleGenerate}>{t("datatableCreate")}</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
