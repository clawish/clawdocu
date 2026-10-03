// Which forges are configured (drives the dashboard source toggle)
export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  return {
    sources: [
      { id: 'github', configured: !!(config.githubToken || process.env.GITHUB_TOKEN) },
      { id: 'gitee', configured: !!(config.giteeToken || process.env.GITEE_TOKEN) },
    ],
  }
})
