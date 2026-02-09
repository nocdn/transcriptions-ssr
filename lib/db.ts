import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source TEXT NOT NULL,
      transcription TEXT NOT NULL
    )
  `
}

export async function saveTranscription(source: string, transcription: string) {
  await ensureTable()
  await sql`
    INSERT INTO transcriptions (source, transcription)
    VALUES (${source}, ${transcription})
  `
}

export async function deleteTranscription(id: number) {
  await ensureTable()
  await sql`DELETE FROM transcriptions WHERE id = ${id}`
}

export async function getTranscriptions() {
  await ensureTable()
  const rows = await sql`
    SELECT id, created_at, source, transcription
    FROM transcriptions
    ORDER BY created_at DESC
    LIMIT 50
  `
  return rows as {
    id: number
    created_at: string
    source: string
    transcription: string
  }[]
}
