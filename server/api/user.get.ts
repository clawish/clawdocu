// Authenticated user info — GitHub primary; falls back to Gitee when only
// GITEE_TOKEN is configured. Both APIs return the same fields we display.
import { getForgeConfig, forgeFetch } from '~~/server/utils/forge'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const hasGithub = !!(config.githubToken || process.env.GITHUB_TOKEN)
  const hasGitee = !!(config.giteeToken || process.env.GITEE_TOKEN)

  const source = hasGithub || !hasGitee ? 'github' : 'gitee'
  const forge = getForgeConfig(source)

  const res = await forgeFetch({ source }, '/user')

  if (!res.ok) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch user info'
    })
  }

  const user = await res.json()

  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    htmlUrl: user.html_url
  }
})
