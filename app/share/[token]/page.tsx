import { db } from "@/db"
import { studioOutputs } from "@/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { SharedQuizClient } from "./shared-quiz-client"
import type { QuizData } from "@/components/notebook/quiz-view"
import { SharedFlashcardsClient } from "./shared-flashcards-client"
import type { FlashcardData } from "@/components/notebook/flashcard-view"
import { SharedMindmapClient } from "./shared-mindmap-client"
import type { MindmapData } from "@/app/api/studio/mindmap/route"
import { ReportView } from "@/components/notebook/report-view"
import type { ReportData } from "@/components/notebook/report-view"
import { SharedAudioClient } from "./shared-audio-client"
import type { AudioData } from "@/app/api/studio/audio/route"
import { SharedSlidedeckClient } from "./shared-slidedeck-client"
import type { SlideData } from "@/lib/google-slides-export"

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const [output] = await db
    .select({
      id: studioOutputs.id,
      type: studioOutputs.type,
      title: studioOutputs.title,
      data: studioOutputs.data,
    })
    .from(studioOutputs)
    .where(eq(studioOutputs.shareToken, token))
    .limit(1)

  if (!output || !output.data) notFound()

  const isMindmap = output.type === "mindmap"
  const isAudio = output.type === "audio"
  const isSlidedeck = output.type === "slidedeck"

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center border-b px-4">
        <span className="text-sm font-semibold">YannBookLM</span>
        {output.title && (
          <span className="text-muted-foreground ml-3 text-sm">· {output.title}</span>
        )}
      </header>
      {isMindmap ? (
        <div className="min-h-0 flex-1">
          <SharedMindmapClient data={output.data as MindmapData} />
        </div>
      ) : isAudio ? (
        <main className="flex-1 overflow-y-auto">
          <SharedAudioClient shareToken={token} data={output.data as AudioData} />
        </main>
      ) : isSlidedeck ? (
        <main className="bg-[#1b1b2e] flex-1 overflow-y-auto">
          <SharedSlidedeckClient data={output.data as SlideData} />
        </main>
      ) : output.type === "report" ? (
        <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto">
          <ReportView data={output.data as ReportData} readonly />
        </main>
      ) : (
        <main className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-6 py-6">
          {output.type === "quiz" ? (
            <SharedQuizClient data={output.data as QuizData} outputId={output.id} />
          ) : output.type === "flashcards" ? (
            <SharedFlashcardsClient data={output.data as FlashcardData} outputId={output.id} />
          ) : (
            notFound()
          )}
        </main>
      )}
    </div>
  )
}
