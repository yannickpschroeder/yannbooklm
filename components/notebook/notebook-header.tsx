"use client"

import { useTranslations } from "next-intl"
import { signOut, useSession } from "next-auth/react"
import { BookOpen, LogOut, Share2, Settings } from "lucide-react"
import { devTodo } from "@/lib/dev-todo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LanguageSwitcher } from "@/components/i18n/language-switcher"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Link } from "@/i18n/navigation"

export function NotebookHeader({ notebookName }: { notebookName: string }) {
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      {/* Left: logo + notebook title */}
      <div className="flex items-center gap-3">
        <Link href="/app" className="text-muted-foreground transition-colors hover:text-foreground">
          <BookOpen className="size-5" />
        </Link>
        <span className="max-w-xs truncate text-sm font-medium">{notebookName}</span>
      </div>

      {/* Right: actions + avatar */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => devTodo("Freigeben")}
        >
          <Share2 className="size-3.5" />
          Freigeben
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => devTodo("Einstellungen")}
        >
          <Settings className="size-3.5" />
          Einstellungen
        </Button>
        <LanguageSwitcher />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 rounded-full transition-opacity hover:opacity-80">
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
    </header>
  )
}
