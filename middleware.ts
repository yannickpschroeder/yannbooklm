import createMiddleware from "next-intl/middleware"
import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { routing } from "./i18n/routing"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)
const handleI18nRouting = createMiddleware(routing)

export default auth((req) => {
  const EXPECTED_USER = process.env.BASIC_AUTH_USER ?? ""
  const EXPECTED_PWD = process.env.BASIC_AUTH_PASSWORD ?? ""

  if (EXPECTED_USER || EXPECTED_PWD) {
    const basicAuth = req.headers.get("authorization")

    if (!basicAuth) {
      return new NextResponse("Zugriff verweigert.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Geschützter Bereich"' },
      })
    }

    // Der Header enthält "Basic <base64-string>", wir isolieren den String
    const authValue = basicAuth.split(" ")[1]
    if (!authValue) {
      return new NextResponse("Ungültiges Auth-Format.", { status: 400 })
    }

    // Dekodieren von Base64 in "benutzername:passwort"
    const [user, pwd] = atob(authValue).split(":")

    // Wenn die Daten NICHT übereinstimmen, fordern wir erneut Zugangsdaten an
    if (user !== EXPECTED_USER || pwd !== EXPECTED_PWD) {
      return new NextResponse("Zugriff verweigert.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Geschützter Bereich"' },
      })
    }
  }

  const pathname = req.nextUrl.pathname
  const segments = pathname.split("/")
  const locale = segments[1] === "en" ? "en" : "de"
  const isLoginPage = /^\/(de|en)\/login|^\/login/.test(pathname)
  const isSharePage = pathname.startsWith("/share/")

  const isLocaleRoot = /^\/(de|en)\/?$/.test(pathname)

  if (isSharePage) return NextResponse.next()

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
