import { db } from "@/db"
import { studioOutputs } from "@/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { SharedQuizClient } from "./shared-quiz-client"
import type { QuizData } from "@/components/notebook/quiz-view"

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const [output] = await db
    .select({ id: studioOutputs.id, type: studioOutputs.type, title: studioOutputs.title, data: studioOutputs.data })
    .from(studioOutputs)
    .where(eq(studioOutputs.shareToken, token))
    .limit(1)

  if (!output || output.type !== "quiz" || !output.data) notFound()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-12 items-center border-b px-4">
        <span className="text-sm font-semibold">YannBookLM</span>
        {output.title && (
          <span className="ml-3 text-sm text-muted-foreground">· {output.title}</span>
        )}
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
        <SharedQuizClient data={output.data as QuizData} outputId={output.id} />
      </main>
    </div>
  )
}
