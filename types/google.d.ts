interface PickerBuilderInstance {
  setOAuthToken(token: string): this
  setDeveloperKey(key: string): this
  addView(view: DocsViewInstance): this
  setCallback(cb: (data: PickerCallbackData) => void): this
  build(): { setVisible(v: boolean): void }
}

interface DocsViewInstance {
  setMimeTypes(types: string): this
  setIncludeFolders(v: boolean): this
}

interface PickerCallbackData {
  action: string
  docs: Array<{ id: string; name: string; mimeType: string }>
}

interface Window {
  gapi: {
    load: (lib: string, config: { callback: () => void; onerror?: () => void }) => void
  }
  google?: {
    picker: {
      PickerBuilder: new () => PickerBuilderInstance
      DocsView: new () => DocsViewInstance
      Response: { ACTION: "action"; DOCUMENTS: "docs" }
      Action: { PICKED: "picked"; CANCEL: "cancel" }
      Document: { ID: "id"; NAME: "name"; MIME_TYPE: "mimeType" }
    }
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
