// Proxy GitHub API requests with token
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.githubToken || process.env.GITHUB_TOKEN
  
  if (!token) {
    throw createError({
      statusCode: 500,
      message: 'GITHUB_TOKEN not configured'
    })
  }
  
  const path = event.path.replace('/api/github/', '')
  const url = `https://api.github.com/${path}`
  
  const method = event.method
  
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  }
  
  const options = { headers, method }
  
  if (method === 'PUT' || method === 'POST') {
    const body = await readBody(event)
    options.body = JSON.stringify(body)
  }
  
  const res = await fetch(url, options)
  
  if (!res.ok) {
    const error = await res.text()
    throw createError({
      statusCode: res.status,
      message: `GitHub API error: ${res.statusText} - ${error}`
    })
  }
  
  return await res.json()
})
