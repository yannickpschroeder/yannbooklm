"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { ChevronUp, ChevronDown, ChevronsUpDown, Download, FileText, Globe } from "lucide-react"
import { FaYoutube } from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { openSourceById } from "@/lib/source-view-event"
import type { DatatableData } from "@/app/api/studio/datatable/route"

type SortDir = "asc" | "desc" | null

function SortIcon({ col, sortCol, sortDir }: { col: number; sortCol: number | null; sortDir: SortDir }) {
  if (sortCol !== col) return <ChevronsUpDown className="size-3 text-muted-foreground/50" />
  if (sortDir === "asc") return <ChevronUp className="size-3 text-primary" />
  return <ChevronDown className="size-3 text-primary" />
}

function SourceIcon({ type }: { type: string }) {
  if (type === "youtube") return <FaYoutube className="size-3 text-red-500" />
  if (type === "url") return <Globe className="size-3 text-blue-400" />
  return <FileText className="size-3 text-red-400" />
}

function exportCsv(title: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function DatatableView({ data }: { data: DatatableData }) {
  const t = useTranslations("studio")
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const handleSort = useCallback((col: number) => {
    setSortCol((prev) => {
      if (prev !== col) {
        setSortDir("asc")
        return col
      }
      setSortDir((d) => {
        if (d === "asc") return "desc"
        setSortCol(null)
        return null
      })
      return col
    })
  }, [])

  const sortedRows = [...data.rows].sort((a, b) => {
    if (sortCol === null || sortDir === null) return 0
    const av = a[sortCol] ?? ""
    const bv = b[sortCol] ?? ""
    const numA = parseFloat(av.replace(/[^0-9.,\-]/g, "").replace(",", "."))
    const numB = parseFloat(bv.replace(/[^0-9.,\-]/g, "").replace(",", "."))
    const cmp =
      !isNaN(numA) && !isNaN(numB)
        ? numA - numB
        : av.localeCompare(bv, undefined, { sensitivity: "base" })
    return sortDir === "asc" ? cmp : -cmp
  })

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
        <span className="text-xs text-muted-foreground">
          {data.rows.length} {data.rows.length === 1 ? "Zeile" : "Zeilen"} · {data.headers.length} Spalten
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => exportCsv(data.title, data.headers, data.rows)}
          >
            <Download className="size-3" />
            {t("datatableExportCsv")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {data.headers.map((h, i) => (
                <th
                  key={i}
                  className="cursor-pointer select-none border-b border-r border-border px-3 py-2 text-left font-medium last:border-r-0 hover:bg-muted/80"
                  onClick={() => handleSort(i)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{h}</span>
                    <SortIcon col={i} sortCol={sortCol} sortDir={sortDir} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-b-0 even:bg-muted/20 hover:bg-muted/40">
                {row.map((cell, ci) => (
                  <td key={ci} className="border-r border-border px-3 py-2 last:border-r-0">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sources footer */}
      {data.usedSources.length > 0 && (
        <div className="shrink-0 border-t px-3 py-2">
          <p className="mb-1.5 text-xs text-muted-foreground">{t("datatableSourcesChip", { count: data.usedSources.length })}</p>
          <div className="flex flex-wrap gap-1.5">
            {data.usedSources.map((s) => (
              <button
                key={s.id}
                onClick={() => openSourceById(s.id)}
                className="flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs hover:bg-muted transition-colors"
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
