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

  // Forge token status — never log values, only set/not set. Gitee features
  // (dashboard toggle, /api/gitee proxy) activate only when GITEE_TOKEN is set.
  // Same precedence as every route: runtimeConfig then env — the config value
  // is baked at build time, env is read fresh at boot (so runtime env works).
  const hasGithub = !!(config.githubToken || process.env.GITHUB_TOKEN)
  const hasGitee = !!(config.giteeToken || process.env.GITEE_TOKEN)
  console.log(
    `[Auth] GITHUB_TOKEN: ${hasGithub ? 'set' : 'not set'} · GITEE_TOKEN: ${hasGitee ? 'set' : 'not set'}${hasGitee ? '' : ' (Gitee disabled)'}`,
  )

  // Share-link URL — same fallback chain as comments/sync.post.ts.
  const clawdocuUrl = config.public?.clawdocuUrl || process.env.CLAWDOCU_URL
  console.log(
    clawdocuUrl
      ? `[URL] CLAWDOCU_URL: ${clawdocuUrl}`
      : '[URL] CLAWDOCU_URL: not set — share links will use https://clawdocu.example.com',
  )

  console.log(`🚀 ClawDocu server started — v${config.version}`)
})
