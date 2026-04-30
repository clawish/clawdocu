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
    
    // Create tables if they don't exist
    client.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER
      )
    `)
    
    client.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
    
    db = drizzle(client, { schema })
  }
  return db
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

export async function createProject(project: { name: string; fullName: string; description: string | null }) {
  const db = getDatabase()
  const id = nanoid()
  await db.insert(schema.projects).values({
    id,
    name: project.name,
    fullName: project.fullName,
    description: project.description,
  })
  return id
}

export async function deleteProject(id: string) {
  const db = getDatabase()
  await db.delete(schema.projects).where(eq(schema.projects.id, id))
}
