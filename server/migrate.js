import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { pool } from './db.js'

try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set before running migrations.')
  const migrations = [
    { file: './schema.sql', label: 'Base application schema' },
    { file: './migrations/002-business-tenancy.sql', label: 'Business tenancy and data-preserving backfill' },
  ]
  for (const migration of migrations) {
    const sql = await readFile(new URL(migration.file, import.meta.url), 'utf8')
    await pool.query(sql)
    console.log(`${migration.label} is ready.`)
  }
} finally {
  await pool.end()
}
