import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/db"
import { notebooks, sources, notes, studioOutputs } from "@/db/schema"
import { and, eq, desc } from "drizzle-orm"
import { NotebookHeader } from "@/components/notebook/notebook-header"
import { SourceSidebar } from "@/components/notebook/source-sidebar"
import { NotebookShell } from "@/components/notebook/notebook-shell"

export default async function NotebookLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ notebookId: string }>
}) {
  const { notebookId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [notebook] = await db
    .select({
      id: notebooks.id,
      name: notebooks.name,
      outputLanguage: notebooks.outputLanguage,
      shareToken: notebooks.shareToken,
      shareScope: notebooks.shareScope,
    })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, session.user.id)))
    .limit(1)

  if (!notebook) notFound()

  const [notebookSources, initialNotes, initialStudioOutputs] = await Promise.all([
    db.select().from(sources).where(eq(sources.notebookId, notebookId)).orderBy(desc(sources.createdAt)),
    db.select().from(notes).where(eq(notes.notebookId, notebookId)).orderBy(desc(notes.createdAt)),
    db.select().from(studioOutputs).where(eq(studioOutputs.notebookId, notebookId)).orderBy(desc(studioOutputs.createdAt)),
  ])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <NotebookHeader
        notebookId={notebook.id}
        notebookName={notebook.name}
        outputLanguage={notebook.outputLanguage}
        shareToken={notebook.shareToken}
        shareScope={notebook.shareScope}
      />
      <div className="flex flex-1 overflow-hidden">
        <SourceSidebar notebookId={notebookId} initialSources={notebookSources} />
        <NotebookShell notebookId={notebookId} initialNotes={initialNotes} initialStudioOutputs={initialStudioOutputs}>
          {children}
        </NotebookShell>
      </div>
    </div>
  )
}
