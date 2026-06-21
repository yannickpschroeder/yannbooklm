"use client"

import { openSourceById } from "@/lib/source-view-event"
import { useTranslations } from "next-intl"
import Markdown from "react-markdown"
import { SourceIcon } from "./chat-citations"

export type ReportSection = { heading: string; content: string }
export type ReportUsedSource = { id: string; title: string; type: string }
export type ReportData = {
  title: string
  sections: ReportSection[]
  format: string
  usedSources?: ReportUsedSource[]
}

export function ReportView({ data, readonly = false }: { data: ReportData; readonly?: boolean }) {
  const tStudio = useTranslations("studio")

  return (
    <div className="flex flex-1 flex-col gap-0 overflow-y-auto">
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-xl leading-tight font-bold">{data.title}</h1>
      </div>

      <div className="flex flex-col divide-y">
        {data.sections.map((section, i) => (
          <div key={i} className="px-5 py-4">
            {section.heading && (
              <h2 className="text-foreground mb-2 text-sm font-semibold">{section.heading}</h2>
            )}
            <div className="prose prose-sm dark:prose-invert text-muted-foreground [&_strong]:text-foreground max-w-none text-sm leading-relaxed [&_li]:mb-0.5 [&_strong]:font-medium [&>ol]:mb-2 [&>ol]:pl-4 [&>p]:mb-2 [&>ul]:mb-2 [&>ul]:pl-4">
              <Markdown>{section.content}</Markdown>
            </div>
          </div>
        ))}
      </div>

      {/* Sources footer */}
      {!readonly && data.usedSources && data.usedSources.length > 0 && (
        <div className="shrink-0 border-t px-3 py-2">
          <p className="text-muted-foreground mb-1.5 text-xs">
            {tStudio("reportSourcesChip", { count: data.usedSources.length })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.usedSources.map((s) => (
              <button
                key={s.id}
                onClick={() => openSourceById(s.id)}
                className="border-border bg-muted/50 hover:bg-muted flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors"
              >
                <SourceIcon type={s.type} />
                <span className="max-w-32 truncate">{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
