"use client"

import { QuizView } from "@/components/notebook/quiz-view"
import type { QuizData } from "@/components/notebook/quiz-view"

export function SharedQuizClient({ data, outputId }: { data: QuizData; outputId: string }) {
  return (
    <QuizView
      data={data}
      outputId={outputId}
      onNewQuizFromTopic={() => undefined}
      readOnly
    />
  )
}
