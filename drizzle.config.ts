import { defineConfig } from 'drizzle-kit'

// Matches the app's env contract: DATABASE_PATH (see runtimeConfig in
// nuxt.config.ts / server/db/index.ts), defaulting to the same
// ./data/clawdocu.db the app uses. dialect MUST be 'turso' (not 'sqlite')
// for libsql — drizzle-kit's 'sqlite' path discards auth tokens and can
// misbehave with libsql URLs (drizzle-orm#5521); 'turso' handles file: URLs
// fine, which is all this app uses.
const localPath = process.env.DATABASE_PATH || './data/clawdocu.db'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: localPath.startsWith('file:') ? localPath : `file:${localPath}`,
  },
})
