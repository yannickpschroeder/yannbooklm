"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, SkipForward } from "lucide-react"

export type QuizQuestion = {
  question: string
  options: string[]
  correct: number
  explanation: string
}

export type QuizUsedSource = { id: string; title: string; type: string }

export type QuizData = {
  questions: QuizQuestion[]
  topics: string[]
  suggestions: string[]
  usedSources?: QuizUsedSource[]
}

type AnswerState = { selected: number | null; skipped: boolean }
type Mode = "quiz" | "review" | "results"

function QuizCircleProgress({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="relative flex size-16 items-center justify-center">
      <svg className="-rotate-90" width="64" height="64">
        <circle cx="32" cy="32" r={r} fill="none" className="stroke-muted-foreground/25" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          className="stroke-primary" strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-xs font-semibold">{current}/{total}</span>
      </div>
    </div>
  )
}

function CircleProgress({ correct, total }: { correct: number; total: number }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="relative flex size-32 items-center justify-center">
      <svg className="-rotate-90" width="128" height="128">
        <circle cx="64" cy="64" r={r} fill="none" className="stroke-muted-foreground/25" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none"
          className="stroke-primary"
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold">{correct}/{total}</span>
        <span className="text-sm text-muted-foreground">{pct}%</span>
      </div>
    </div>
  )
}

export function QuizView({
  data,
  outputId,
  onNewQuizFromTopic,
  readOnly = false,
}: {
  data: QuizData
  notebookId?: string
  outputId: string
  onRegenerate?: () => void
  onNewQuizFromTopic: (topic: string, outputId: string) => void
  readOnly?: boolean
}) {
  const [mode, setMode] = useState<Mode>("quiz")
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerState[]>(
    () => data.questions.map(() => ({ selected: null, skipped: false }))
  )
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null)

  const q = data.questions[index]
  const answer = answers[index]
  const hasAnswered = answer.selected !== null || answer.skipped

  const stats = answers.reduce(
    (acc, a, i) => {
      if (a.skipped) acc.skipped++
      else if (a.selected === data.questions[i].correct) acc.correct++
      else if (a.selected !== null) acc.wrong++
      return acc
    },
    { correct: 0, wrong: 0, skipped: 0 }
  )

  function selectAnswer(optIndex: number) {
    if (hasAnswered) return
    setAnswers((prev) => prev.map((a, i) => (i === index ? { selected: optIndex, skipped: false } : a)))
  }

  function skip() {
    if (hasAnswered) return
    setAnswers((prev) => prev.map((a, i) => (i === index ? { selected: null, skipped: true } : a)))
  }

  function next() {
    if (index < data.questions.length - 1) {
      setIndex(index + 1)
    } else {
      setMode("results")
    }
  }

  function restart(reviewMode: boolean) {
    setIndex(0)
    if (!reviewMode) setAnswers(data.questions.map(() => ({ selected: null, skipped: false })))
    setMode(reviewMode ? "review" : "quiz")
  }

  function getOptionClass(optIndex: number) {
    const isCorrect = optIndex === q.correct
    const isSelected = answer.selected === optIndex

    if (mode === "review") {
      return isCorrect
        ? "border-green-500 bg-green-500/10 text-green-500"
        : "border-muted text-muted-foreground opacity-50"
    }

    if (!hasAnswered) return "border-border hover:border-primary hover:bg-muted cursor-pointer"

    if (isSelected && isCorrect) return "border-green-500 bg-green-500/10 text-green-500"
    if (isSelected && !isCorrect) return "border-destructive bg-destructive/10 text-destructive"
    if (isCorrect) return "border-green-500 bg-green-500/10 text-green-500"
    return "border-muted text-muted-foreground opacity-50"
  }

  function getFeedbackLabel(): string | null {
    if (!hasAnswered && mode !== "review") return null
    if (answer.skipped || (mode === "review" && answer.selected === null)) {
      return "Richtige Antwort(übersprungen)"
    }
    if (answer.selected === q.correct) return "Richtige Antwort"
    return "Falsche Antwort"
  }

  // ── Results screen ──────────────────────────────────────────────────────────
  if (mode === "results") {
    return (
      <div className={cn("flex flex-1 flex-col gap-6 overflow-y-auto p-5", readOnly && "items-center")}>
        <h2 className="text-xl font-bold">Geschafft! Quiz abgeschlossen.</h2>

        <div className="flex items-center gap-6">
          <CircleProgress correct={stats.correct} total={data.questions.length} />
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted-foreground">Richtig</span>
              <span className="font-semibold text-green-500">{stats.correct}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted-foreground">Falsch</span>
              <span className="font-semibold text-destructive">{stats.wrong}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 text-muted-foreground">Übersprungen</span>
              <span className="font-semibold">{stats.skipped}</span>
            </div>
          </div>
        </div>

        <div className={readOnly ? "flex flex-col gap-4" : "grid grid-cols-2 gap-4"}>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Behandelte Themen</h3>
            <ul className="space-y-1">
              {data.topics.map((t) => (
                <li key={t} className="text-sm text-muted-foreground">• {t}</li>
              ))}
            </ul>
          </div>
          {!readOnly && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Weiterlernen</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Wählen Sie unten Themen für die Wiederholung aus und erstellen Sie ein neues Quiz.
              </p>
              <div className="flex flex-col gap-1.5">
                {data.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSuggestion(s === selectedSuggestion ? null : s)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-xs transition-colors",
                      s === selectedSuggestion
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    {s}
                  </button>
                ))}
                <Button
                  size="sm"
                  className="mt-1"
                  disabled={!selectedSuggestion}
                  onClick={() => selectedSuggestion && onNewQuizFromTopic(selectedSuggestion, outputId)}
                >
                  Quiz erstellen
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className={cn("flex gap-2 border-t pt-4", readOnly && "justify-center")}>
          <Button variant="outline" size="sm" onClick={() => restart(true)}>
            Quiz noch einmal ansehen
          </Button>
          <Button size="sm" onClick={() => restart(false)}>
            Quiz wiederholen
          </Button>
        </div>
      </div>
    )
  }

  // ── Question screen (quiz + review) ────────────────────────────────────────
  const feedbackLabel = getFeedbackLabel()

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
      {/* Progress */}
      <div className="flex justify-center">
        <QuizCircleProgress current={index + 1} total={data.questions.length} />
      </div>

      {/* Question */}
      <p className="text-base font-medium leading-snug">{q.question}</p>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => {
          const labels = ["A", "B", "C", "D"]
          const isCorrect = i === q.correct
          const showFeedback = (hasAnswered || mode === "review") && isCorrect
          return (
            <button
              key={i}
              onClick={() => selectAnswer(i)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors",
                getOptionClass(i)
              )}
            >
              <span><strong>{labels[i]}.</strong> {opt}</span>
              {showFeedback && feedbackLabel && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-500">
                  <CheckCircle2 className="size-3" />
                  {feedbackLabel}
                </span>
              )}
              {hasAnswered && answer.selected === i && !isCorrect && (
                <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                  <XCircle className="size-3" />
                  Falsche Antwort
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Explanation */}
      {(hasAnswered || mode === "review") && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {q.explanation}
        </p>
      )}

      {/* Actions */}
      <div className="mt-auto flex gap-2">
        {!hasAnswered && mode === "quiz" && (
          <Button variant="ghost" size="sm" onClick={skip}>
            <SkipForward className="mr-1 size-3" />
            Überspringen
          </Button>
        )}
        {(hasAnswered || mode === "review") && (
          <Button size="sm" onClick={next} className="ml-auto">
            {index < data.questions.length - 1 ? "Weiter" : "Ergebnis ansehen"}
          </Button>
        )}
      </div>
    </div>
  )
}
