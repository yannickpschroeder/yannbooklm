"use client"

import { marked } from "marked"

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }): { requestAccessToken(): void }
        }
      }
    }
  }
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
const GIS_SRC = "https://accounts.google.com/gsi/client"

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
      scope: DRIVE_SCOPE,
      callback(response) {
        if (response.access_token) resolve(response.access_token)
        else reject(new Error(response.error ?? "OAuth failed"))
      },
    })
    client.requestAccessToken()
  })
}

async function createGoogleDoc(accessToken: string, title: string, html: string): Promise<string> {
  const boundary = "yannbooklm_boundary"
  const metadata = JSON.stringify({ name: title, mimeType: "application/vnd.google-apps.document" })
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    `--${boundary}--`,
  ].join("\r\n")

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? "Drive API error")
  }

  const { id } = (await res.json()) as { id: string }
  return `https://docs.google.com/document/d/${id}/edit`
}

export async function exportNoteToGoogleDocs(title: string, markdownContent: string): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID not set")

  await loadGis()
  const accessToken = await getAccessToken(clientId)

  const html = await marked(markdownContent, { gfm: true })
  const fullHtml = `<html><head><meta charset="UTF-8"><title>${title}</title></head><body>${html}</body></html>`

  return createGoogleDoc(accessToken, title, fullHtml)
}
