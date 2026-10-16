import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { pool } from './db.js'

try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set before running migrations.')
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
  await pool.query(schema)
  console.log('D’Queens app_* tables and append-only activity trigger are ready.')
} finally {
  await pool.end()
}
