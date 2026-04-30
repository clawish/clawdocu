export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.githubToken || process.env.GITHUB_TOKEN
  if (!token) {
    throw createError({
      statusCode: 500,
      message: 'GITHUB_TOKEN not configured'
    })
  }
  
  // List repositories for the authenticated user
  const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  })
  
  if (!res.ok) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch repositories'
    })
  }
  
  const repos = await res.json()
  
  // Filter to private repos or repos with write access
  const accessibleRepos = repos
    .filter((repo: any) => repo.private || repo.permissions?.push)
    .map((repo: any) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      language: repo.language
    }))
  
  return accessibleRepos
})
