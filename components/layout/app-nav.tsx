"use client"

import { useTranslations } from "next-intl"
import { signOut, useSession } from "next-auth/react"
import { BookOpen, LogOut } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Link } from "@/i18n/navigation"

export function AppNav() {
  const { data: session } = useSession()
  const t = useTranslations("auth")

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
        <Link href="/app" className="flex items-center gap-2 font-semibold">
          <BookOpen className="size-5 text-primary" />
          YannBookLM
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full ring-offset-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Avatar className="size-8">
                <AvatarImage src={session?.user?.image ?? ""} alt={session?.user?.name ?? ""} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-sm">
                <p className="font-medium">{session?.user?.name}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              </div>
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                <LogOut className="mr-2 size-4" />
                {t("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
