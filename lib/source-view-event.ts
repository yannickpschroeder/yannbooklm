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

const OPEN_SOURCE_EVENT = "yannbooklm:open-source"

export function openSourceById(sourceId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_SOURCE_EVENT, { detail: sourceId }))
}

export function onOpenSourceById(cb: (sourceId: string) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<string>).detail)
  window.addEventListener(OPEN_SOURCE_EVENT, handler)
  return () => window.removeEventListener(OPEN_SOURCE_EVENT, handler)
}
