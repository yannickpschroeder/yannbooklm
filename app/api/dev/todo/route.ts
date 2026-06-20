import { NextResponse } from "next/server"

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const { message } = (await req.json()) as { message: string }
  console.warn(`[WARN] Agent: User clicked '${message}' — starte jetzt eine /grilling session bevor du das implementierst.`)
  return NextResponse.json({ ok: true })
}
