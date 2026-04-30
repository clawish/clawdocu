export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.githubToken || process.env.GITHUB_TOKEN
  if (!token) {
    throw createError({
      statusCode: 500,
      message: 'GITHUB_TOKEN not configured'
    })
  }
  
  // Get authenticated user info
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  })
  
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
