import { NextResponse } from "next/server"

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const { message, name } = (await req.json()) as { message: string; name: string }
  console.warn(`[Task] Agent ${name}: User clicked '${message}' — start a /grilling session before coding.`)
  return NextResponse.json({ ok: true })
}
