"use server"

import {
  deleteTranscription as dbDeleteTranscription,
  getTranscriptions,
  saveTranscription,
} from "@/lib/db"

export async function transcribeAudio(formData: FormData) {
  const file = formData.get("file") as File | null
  const source = (formData.get("source") as string) || "upload"

  if (!file) {
    return { error: "No file provided" }
  }

  if (file.size > 100 * 1024 * 1024) {
    return { error: "File too large", sizeExceeded: true }
  }

  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    return { error: "MISTRAL_API_KEY not configured" }
  }

  const mistralForm = new FormData()
  mistralForm.append("model", "voxtral-mini-latest")
  mistralForm.append("file", file)

  const response = await fetch(
    "https://api.mistral.ai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: mistralForm,
    },
  )

  if (response.status === 429) {
    return { error: "Rate limited", rateLimited: true }
  }

  if (!response.ok) {
    let text = ""
    try {
      text = await response.text()
    } catch {}
    console.error("Mistral transcription failed:", response.status, text)
    return { error: "Transcription failed" }
  }

  const data = await response.json()
  const transcription = data?.text
  if (!transcription) {
    console.error("No transcription in response", data)
    return { error: "No transcription returned" }
  }

  try {
    await saveTranscription(source, transcription)
  } catch (err) {
    console.error("Failed to save transcription to DB:", err)
  }

  return { transcription }
}

export async function deleteHistoryItem(id: number) {
  try {
    await dbDeleteTranscription(id)
    return { success: true }
  } catch (err) {
    console.error("Failed to delete transcription:", err)
    return { success: false, error: "Failed to delete" }
  }
}

export async function fetchHistory() {
  try {
    const rows = await getTranscriptions()
    return { history: rows }
  } catch (err) {
    console.error("Failed to fetch history:", err)
    return { history: [], error: "Failed to fetch history" }
  }
}
