"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const LANGUAGES = [
  { value: null,   label: "outputLanguageAuto" },
  { value: "de",   label: "Deutsch" },
  { value: "en",   label: "English" },
  { value: "fr",   label: "Français" },
  { value: "es",   label: "Español" },
  { value: "it",   label: "Italiano" },
  { value: "pt",   label: "Português" },
  { value: "nl",   label: "Nederlands" },
  { value: "pl",   label: "Polski" },
  { value: "ru",   label: "Русский" },
  { value: "zh",   label: "中文" },
  { value: "ja",   label: "日本語" },
] as const

export function OutputLanguageModal({
  open,
  onOpenChange,
  notebookId,
  currentLanguage,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  notebookId: string
  currentLanguage: string | null
  onSaved: (lang: string | null) => void
}) {
  const t = useTranslations("settings")
  const tCommon = useTranslations("common")
  const [selected, setSelected] = useState<string | null>(currentLanguage)
  const [applyToAll, setApplyToAll] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputLanguage: selected, applyToAll }),
      })
      if (!res.ok) throw new Error()
      onSaved(selected)
      onOpenChange(false)
      toast.success(t("outputLanguageSaveSuccess"))
    } catch {
      toast.error(t("outputLanguageError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("outputLanguageModalTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">{t("outputLanguageLabel")}</label>
          <select
            value={selected ?? ""}
            onChange={(e) => setSelected(e.target.value === "" ? null : e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value ?? "__auto__"} value={lang.value ?? ""}>
                {lang.value === null ? t(lang.label as "outputLanguageAuto") : lang.label}
              </option>
            ))}
          </select>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="size-4 rounded"
            />
            {t("applyToAll")}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tCommon("cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{tCommon("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
