import type { CitationChunk } from "@/lib/types/chat"

const EVENT = "yannbooklm:source-view"

export function openSourceView(chunk: CitationChunk) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: chunk }))
}

export function closeSourceView() {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: null }))
}

export function onSourceView(cb: (chunk: CitationChunk | null) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<CitationChunk | null>).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
