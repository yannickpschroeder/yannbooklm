const AGENT_NAMES = ["Bob", "Alice", "Eve"] as const

function pickAgent(): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div")
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999"

    const card = document.createElement("div")
    card.style.cssText = "background:var(--background);border:1px solid var(--border);border-radius:12px;padding:20px 24px;display:flex;flex-direction:column;gap:12px;min-width:220px;box-shadow:0 8px 32px rgba(0,0,0,.25)"

    const label = document.createElement("p")
    label.textContent = "Agent auswählen"
    label.style.cssText = "margin:0;font-size:13px;font-weight:600;color:var(--foreground)"
    card.appendChild(label)

    const btnWrap = document.createElement("div")
    btnWrap.style.cssText = "display:flex;flex-direction:column;gap:8px"

    for (const name of AGENT_NAMES) {
      const btn = document.createElement("button")
      btn.textContent = name
      btn.style.cssText = "padding:8px 14px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--foreground);font-size:13px;cursor:pointer;text-align:left;transition:background .15s"
      btn.onmouseenter = () => { btn.style.background = "var(--muted)" }
      btn.onmouseleave = () => { btn.style.background = "var(--card)" }
      btn.onclick = () => { document.body.removeChild(overlay); resolve(name) }
      btnWrap.appendChild(btn)
    }

    const cancel = document.createElement("button")
    cancel.textContent = "Abbrechen"
    cancel.style.cssText = "padding:6px 14px;border:none;background:none;color:var(--muted-foreground);font-size:12px;cursor:pointer;margin-top:2px"
    cancel.onclick = () => { document.body.removeChild(overlay); resolve(null) }

    card.appendChild(btnWrap)
    card.appendChild(cancel)
    overlay.appendChild(card)
    overlay.onclick = (e) => { if (e.target === overlay) { document.body.removeChild(overlay); resolve(null) } }
    document.body.appendChild(overlay)
  })
}

export async function devTodo(feature: string) {
  if (process.env.NODE_ENV !== "development") return
  const name = await pickAgent()
  if (!name) return
  fetch("/api/dev/todo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: feature, name }),
  }).catch(() => undefined)
}
