"use client"

import { MindmapCanvas } from "@/components/notebook/mindmap-canvas"
import type { MindmapData } from "@/app/api/studio/mindmap/route"

export function SharedMindmapClient({ data }: { data: MindmapData }) {
  return (
    <div className="h-[calc(100vh-3rem)] w-full">
      <MindmapCanvas data={data} />
    </div>
  )
}
