import createMiddleware from "next-intl/middleware"
import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { routing } from "./i18n/routing"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)
const handleI18nRouting = createMiddleware(routing)

export default auth((req) => {
  const pathname = req.nextUrl.pathname
  const segments = pathname.split("/")
  const locale = segments[1] === "en" ? "en" : "de"
  const isLoginPage = /^\/(de|en)\/login|^\/login/.test(pathname)

  const isLocaleRoot = /^\/(de|en)\/?$/.test(pathname)

  if (!req.auth && !isLoginPage) {
    return NextResponse.redirect(new URL(`/${locale}/login`, req.nextUrl))
  }

  if (req.auth && (isLoginPage || isLocaleRoot)) {
    return NextResponse.redirect(new URL(`/${locale}/app`, req.nextUrl))
  }

  return handleI18nRouting(req)
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|.*\\..*).*)"],
}
