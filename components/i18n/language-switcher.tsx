"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter, usePathname } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Languages } from "lucide-react"

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations("navigation")

  function toggle() {
    const next = locale === "de" ? "en" : "de"
    router.replace(pathname, { locale: next })
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="gap-1.5">
      <Languages className="size-4" />
      {t("switchLanguage")}
    </Button>
  )
}
