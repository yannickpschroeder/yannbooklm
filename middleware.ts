import createMiddleware from "next-intl/middleware"
import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { routing } from "./i18n/routing"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)
const handleI18nRouting = createMiddleware(routing)

export default auth((req) => {
  const pathname = req.nextUrl.pathname
  const isAppRoute = /^\/(de|en)\/app/.test(pathname)

  if (isAppRoute && !req.auth) {
    const locale = pathname.startsWith("/en/") ? "en" : "de"
    return NextResponse.redirect(new URL(`/${locale}/login`, req.nextUrl))
  }

  return handleI18nRouting(req)
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|.*\\..*).*)"],
}
