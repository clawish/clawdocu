// List repositories for the authenticated user (GitHub or Gitee)
import { getForgeConfig, forgeFetch } from '~~/server/utils/forge'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const source = query.source === 'gitee' ? 'gitee' : 'github'

  const forge = getForgeConfig(source)

  const res = await forgeFetch({ source }, '/user/repos?per_page=100&sort=updated')

  if (!res.ok) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch repositories from ${source}`
    })
  }

  const repos = await res.json()

  let accessibleRepos: any[]
  if (source === 'gitee') {
    // Gitee repo objects have no permissions object — a personal token only
    // lists repos it can access, so no push filter is possible/needed.
    accessibleRepos = repos.map((repo: any) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      language: repo.language,
    }))
  } else {
    // Filter to private repos or repos with write access, exclude ClawDocu repo itself
    accessibleRepos = repos
      .filter((repo: any) => repo.private || repo.permissions?.push)
      .filter((repo: any) => repo.full_name.toLowerCase() !== 'clawish/clawdocu')
      .map((repo: any) => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        language: repo.language,
      }))
  }

  return accessibleRepos.map(r => ({ ...r, source }))
})
