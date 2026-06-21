import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SignInWithGitHub, SignInWithGoogle } from "@/components/auth/sign-in-button"
import { BookOpen } from "lucide-react"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const session = await auth()
  if (session) redirect(`/${locale}/app`)

  const t = await getTranslations("auth")

  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-2 flex size-10 items-center justify-center rounded-lg">
            <BookOpen className="size-5" />
          </div>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SignInWithGoogle label={t("continueWithGoogle")} />
          {/* <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">{t("or")}</span>
            <Separator className="flex-1" />
          </div>
          <SignInWithGitHub label={t("continueWithGitHub")} /> */}
        </CardContent>
      </Card>
    </main>
  )
}
