import { drizzle } from 'drizzle-orm/libsql'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

// Export schema for convenience
export const tables = schema

// Singleton database instance
let db: LibSQLDatabase<typeof schema> | undefined
let client: ReturnType<typeof createClient> | undefined

/**
 * Get or create the database instance
 */
export function getDatabase(): LibSQLDatabase<typeof schema> {
  if (!db) {
    const config = useRuntimeConfig()
    // Use data directory for database
    const dbPath = config.databasePath || path.join(process.cwd(), 'data', 'clawdocu.db')

    console.log(`[DB] Connecting to SQLite: ${dbPath}`)

    // Ensure the directory exists
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    client = createClient({ url: `file:${dbPath}` })

    // Fire-and-forget fallback (same pattern as before). The authoritative,
    // awaited schema check runs in server/plugins/startup.ts via ensureSchema(),
    // so tables/columns are guaranteed before the server accepts traffic.
    ensureSchema().catch((err) => console.error('[DB] ensureSchema failed:', err))

    db = drizzle(client, { schema })
  }
  return db
}

/**
 * Create tables if missing and heal databases from older versions
 * (e.g. add columns introduced after the DB was first created —
 * CREATE TABLE IF NOT EXISTS can't alter existing tables).
 * Awaited by the startup Nitro plugin before traffic is accepted;
 * the full baseline for fresh installs lives in server/db/migrations/
 * (npm run db:migrate).
 */
export async function ensureSchema(): Promise<void> {
  if (!client) throw new Error('[DB] client not initialised — call getDatabase() first')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL DEFAULT 'github',
      created_at INTEGER
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
  const projectCols = await client.execute(`PRAGMA table_info(projects)`)
  if (!projectCols.rows.some((row) => row.name === 'source')) {
    console.log('[DB] Adding missing column: projects.source')
    await client.execute(`ALTER TABLE projects ADD COLUMN source TEXT NOT NULL DEFAULT 'github'`)
  }
}

// Helper functions using Drizzle
import { eq, desc, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export async function getProjects() {
  const db = getDatabase()
  return db.select().from(schema.projects).orderBy(desc(schema.projects.createdAt))
}

export async function getProject(id: string) {
  const db = getDatabase()
  const results = await db.select().from(schema.projects).where(eq(schema.projects.id, id))
  return results[0]
}

export async function createProject(project: { name: string; fullName: string; description: string | null, id?: string, source?: string }) {
  const db = getDatabase()
  const id = project.id || nanoid()
  await db.insert(schema.projects).values({
    id,
    name: project.name,
    fullName: project.fullName,
    description: project.description,
    source: project.source || 'github',
  })
  return id
}

export async function deleteProject(id: string) {
  const db = getDatabase()
  await db.delete(schema.projects).where(eq(schema.projects.id, id))
}
