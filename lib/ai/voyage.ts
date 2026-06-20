const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"
const VOYAGE_MODEL = "voyage-4-lite"

async function fetchWithRetry(body: object, attempt = 0): Promise<Response> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY!}`,
    },
    body: JSON.stringify(body),
  })

  if (res.status === 429 && attempt < 8) {
    const retryAfter = res.headers.get("retry-after")
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(2000 * 2 ** attempt, 30_000)
    await new Promise((r) => setTimeout(r, delay))
    return fetchWithRetry(body, attempt + 1)
  }

  return res
}

export async function embedText(text: string): Promise<number[]> {
  const res = await fetchWithRetry({ input: [text], model: VOYAGE_MODEL })
  if (!res.ok) throw new Error(`Voyage AI embedding failed: ${res.statusText}`)
  const json = (await res.json()) as { data: { embedding: number[] }[] }
  return json.data[0].embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetchWithRetry({ input: texts, model: VOYAGE_MODEL })
  if (!res.ok) throw new Error(`Voyage AI batch embedding failed: ${res.statusText}`)
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] }
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}
