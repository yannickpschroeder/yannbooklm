"use client"

export type DriveFile = { id: string; name: string; mimeType: string; accessToken: string }

const GAPI_SRC = "https://apis.google.com/js/api.js"
const GIS_SRC = "https://accounts.google.com/gsi/client"
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
const SUPPORTED_MIME_TYPES = "application/pdf,application/vnd.google-apps.document"

function loadGapi(): Promise<void> {
  if (typeof window.gapi !== "undefined") return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = GAPI_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Google API script failed to load"))
    document.head.appendChild(script)
  })
}

function loadGapiPicker(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    await loadGapi()
    window.gapi.load("picker", { callback: resolve, onerror: reject })
  })
}

function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Google Identity Services failed to load"))
    document.head.appendChild(script)
  })
}

function getAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts!.oauth2.initTokenClient({
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

export async function openDrivePicker(): Promise<DriveFile | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID not set")
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY

  await Promise.all([loadGapiPicker(), loadGis()])
  const accessToken = await getAccessToken(clientId)

  return new Promise((resolve) => {
    const g = window.google!
    const view = new g.picker.DocsView()
      .setMimeTypes(SUPPORTED_MIME_TYPES)
      .setIncludeFolders(false)

    let builder = new g.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .addView(view)
      .setCallback((data: PickerCallbackData) => {
        if (data.action === "picked" && data.docs?.[0]) {
          const doc = data.docs[0]
          resolve({ id: doc.id, name: doc.name, mimeType: doc.mimeType, accessToken })
        } else if (data.action === "cancel") {
          resolve(null)
        }
      })

    if (apiKey) builder = builder.setDeveloperKey(apiKey)
    builder.build().setVisible(true)
  })
}

export async function downloadDriveFile(file: DriveFile): Promise<File> {
  const isGoogleDoc = file.mimeType === "application/vnd.google-apps.document"
  const url = isGoogleDoc
    ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=application/pdf`
    : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`

  const res = await fetch(url, { headers: { Authorization: `Bearer ${file.accessToken}` } })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? "Drive-Download fehlgeschlagen")
  }

  const blob = await res.blob()
  const name = file.name.endsWith(".pdf") ? file.name : `${file.name}.pdf`
  return new File([blob], name, { type: "application/pdf" })
}
