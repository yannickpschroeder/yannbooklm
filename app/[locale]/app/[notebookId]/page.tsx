import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/db"
import { sources } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { ChatPanel } from "@/components/notebook/chat-panel"

export default async function NotebookPage({
  params,
}: {
  params: Promise<{ notebookId: string }>
}) {
  const { notebookId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const readySources = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.notebookId, notebookId), eq(sources.status, "ready")))

  return <ChatPanel notebookId={notebookId} readySourceCount={readySources.length} />
}
