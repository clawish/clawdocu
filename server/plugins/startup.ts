export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  // Ensure schema before traffic: creates tables on fresh installs and heals
  // older DBs (e.g. adds projects.source for pre-Gitee databases).
  try {
    const { getDatabase, ensureSchema } = await import('~~/server/db')
    getDatabase()
    await ensureSchema()
    console.log('[DB] schema ready')
  } catch (err) {
    console.error('[DB] schema check failed:', err)
  }
  console.log(`🚀 ClawDocu server started — v${config.version}`)
})
