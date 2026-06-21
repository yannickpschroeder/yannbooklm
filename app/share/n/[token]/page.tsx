import { db } from "@/db"
import { notebooks, sources, studioOutputs } from "@/db/schema"
import { and, eq, desc } from "drizzle-orm"
import { notFound } from "next/navigation"
import { SharedNotebookClient } from "./shared-notebook-client"
import type { Source, StudioOutput } from "@/db/schema"

export default async function SharedNotebookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const [notebook] = await db
    .select({ id: notebooks.id, name: notebooks.name, shareScope: notebooks.shareScope })
    .from(notebooks)
    .where(eq(notebooks.shareToken, token))
    .limit(1)

  if (!notebook) notFound()

  const includeStudio = notebook.shareScope === "sources_chat_studio"

  const [notebookSources, notebookOutputs] = await Promise.all([
    db
      .select({ id: sources.id, title: sources.title, type: sources.type, status: sources.status })
      .from(sources)
      .where(and(eq(sources.notebookId, notebook.id), eq(sources.status, "ready"), eq(sources.enabled, true)))
      .orderBy(desc(sources.createdAt)),
    includeStudio
      ? db
          .select()
          .from(studioOutputs)
          .where(eq(studioOutputs.notebookId, notebook.id))
          .orderBy(desc(studioOutputs.createdAt))
      : Promise.resolve([] as StudioOutput[]),
  ])

  return (
    <SharedNotebookClient
      token={token}
      notebookName={notebook.name}
      sources={notebookSources as Pick<Source, "id" | "title" | "type" | "status">[]}
      studioOutputs={notebookOutputs}
      includeStudio={includeStudio}
    />
  )
}
