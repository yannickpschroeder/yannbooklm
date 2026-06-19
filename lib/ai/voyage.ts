const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"
const VOYAGE_MODEL = "voyage-4-lite"

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY!}`,
    },
    body: JSON.stringify({ input: [text], model: VOYAGE_MODEL }),
  })

  if (!res.ok) {
    throw new Error(`Voyage AI embedding failed: ${res.statusText}`)
  }

  const json = (await res.json()) as { data: { embedding: number[] }[] }
  return json.data[0].embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY!}`,
    },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL }),
  })

  if (!res.ok) {
    throw new Error(`Voyage AI batch embedding failed: ${res.statusText}`)
  }

  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] }
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}
