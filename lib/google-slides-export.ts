"use client"

const SLIDES_SCOPE = "https://www.googleapis.com/auth/presentations"
const GIS_SRC = "https://accounts.google.com/gsi/client"

// Slide canvas dimensions in EMU (English Metric Units, 914400 per inch)
// Standard 16:9: 10 × 5.625 inches
const W = 9144000
const H = 5143500
const MARGIN_X = 457200  // 0.5 in
const CONTENT_W = W - 2 * MARGIN_X

function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("GIS failed to load"))
    document.head.appendChild(script)
  })
}

function getAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SLIDES_SCOPE,
      callback(response) {
        if (response.access_token) resolve(response.access_token)
        else reject(new Error(response.error ?? "OAuth failed"))
      },
    })
    client.requestAccessToken()
  })
}

export type SlideData = {
  presentationTitle: string
  slides: Array<{
    title: string
    bullets: string[]
    speakerNotes?: string
  }>
}

export function slidesUrlToExportUrl(slidesUrl: string, format: "pdf" | "pptx" | "present"): string {
  const base = slidesUrl.replace(/\/edit.*$/, "")
  if (format === "present") return `${base}/present`
  return `${base}/export/${format}`
}

function emu(val: number) {
  return { magnitude: val, unit: "EMU" as const }
}

function box(pageObjectId: string, x: number, y: number, w: number, h: number) {
  return {
    pageObjectId,
    size: { width: emu(w), height: emu(h) },
    transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: "EMU" as const },
  }
}

export async function exportToGoogleSlides(slideData: SlideData): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID not set")

  await loadGis()
  const accessToken = await getAccessToken(clientId)
  const authHeader = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }

  // Step 1: Create an empty presentation
  const createRes = await fetch("https://slides.googleapis.com/v1/presentations", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ title: slideData.presentationTitle }),
  })
  if (!createRes.ok) {
    const err = (await createRes.json()) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? "Failed to create presentation")
  }
  const { presentationId, slides: initSlides } = (await createRes.json()) as {
    presentationId: string
    slides: Array<{ objectId: string }>
  }
  const slidesUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`

  // Step 2: Build all requests in a single batchUpdate.
  // We use BLANK slides + explicit createShape (TEXT_BOX) so we control all objectIds.
  // No GET needed — we define the IDs ourselves.
  const requests: unknown[] = [
    { deleteObject: { objectId: initSlides[0].objectId } },
  ]

  slideData.slides.forEach((slide, i) => {
    const slideId = `slide_${i}`
    const titleId = `title_${i}`
    const bodyId = `body_${i}`
    const isTitleSlide = i === 0

    requests.push({
      createSlide: { objectId: slideId, insertionIndex: i },
    })

    // ── Title text box ──
    const titleY = isTitleSlide ? Math.round(H * 0.23) : Math.round(H * 0.05)
    const titleH = isTitleSlide ? Math.round(H * 0.30) : Math.round(H * 0.18)
    requests.push({
      createShape: {
        objectId: titleId,
        shapeType: "TEXT_BOX",
        elementProperties: box(slideId, MARGIN_X, titleY, CONTENT_W, titleH),
      },
    })
    if (slide.title) {
      requests.push({ insertText: { objectId: titleId, text: slide.title } })
      requests.push({
        updateTextStyle: {
          objectId: titleId,
          style: { fontSize: emu(isTitleSlide ? 36 : 24), bold: true, foregroundColor: { opaqueColor: { rgbColor: { red: 0.1, green: 0.1, blue: 0.1 } } } },
          textRange: { type: "ALL" },
          fields: "fontSize,bold,foregroundColor",
        },
      })
      if (isTitleSlide) {
        requests.push({
          updateParagraphStyle: {
            objectId: titleId,
            style: { alignment: "CENTER" },
            textRange: { type: "ALL" },
            fields: "alignment",
          },
        })
      }
    }

    // ── Body / bullets text box ──
    if (slide.bullets.length > 0) {
      const bodyY = isTitleSlide ? Math.round(H * 0.57) : Math.round(H * 0.26)
      const bodyH = isTitleSlide ? Math.round(H * 0.24) : Math.round(H * 0.68)
      requests.push({
        createShape: {
          objectId: bodyId,
          shapeType: "TEXT_BOX",
          elementProperties: box(slideId, MARGIN_X, bodyY, CONTENT_W, bodyH),
        },
      })
      requests.push({ insertText: { objectId: bodyId, text: slide.bullets.join("\n") } })
      requests.push({
        updateTextStyle: {
          objectId: bodyId,
          style: {
            fontSize: emu(isTitleSlide ? 18 : 14),
            foregroundColor: { opaqueColor: { rgbColor: { red: 0.3, green: 0.3, blue: 0.3 } } },
          },
          textRange: { type: "ALL" },
          fields: "fontSize,foregroundColor",
        },
      })
      if (isTitleSlide) {
        requests.push({
          updateParagraphStyle: {
            objectId: bodyId,
            style: { alignment: "CENTER" },
            textRange: { type: "ALL" },
            fields: "alignment",
          },
        })
      } else {
        requests.push({
          createParagraphBullets: {
            objectId: bodyId,
            textRange: { type: "ALL" },
            bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
          },
        })
      }
    }
  })

  const batchRes = await fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
    { method: "POST", headers: authHeader, body: JSON.stringify({ requests }) }
  )
  if (!batchRes.ok) {
    const errText = await batchRes.text()
    console.error(`Slides batchUpdate failed (${batchRes.status}):`, errText)
    // Still return the URL so the user can access the (empty) presentation
  }

  return slidesUrl
}
