"use client"

import { FlashcardView } from "@/components/notebook/flashcard-view"
import type { FlashcardData } from "@/components/notebook/flashcard-view"

export function SharedFlashcardsClient({ data, outputId }: { data: FlashcardData; outputId: string }) {
  return (
    <FlashcardView
      data={data}
      outputId={outputId}
      readOnly
    />
  )
}
