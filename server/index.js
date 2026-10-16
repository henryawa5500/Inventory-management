import 'dotenv/config'
import { app } from './app.js'

const port = Number(process.env.PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT must be a valid TCP port.')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters.')
}

const server = app.listen(port, () => {
  console.log(`D’Queens API listening on port ${port}`)
})

function shutdown(signal) {
  console.log(`Received ${signal}; closing the API server.`)
  server.close(async (error) => {
    if (error) {
      console.error('Error while closing the HTTP server', error)
      process.exitCode = 1
    }
    const { pool } = await import('./db.js')
    await pool.end()
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
