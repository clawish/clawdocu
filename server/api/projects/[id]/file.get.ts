// Get file content from GitHub
import { getProject } from '~~/server/db/index'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const filePath = getQuery(event).path as string || ''
  const branch = getQuery(event).branch as string || 'main'
  
  if (!filePath) {
    throw createError({ statusCode: 400, message: 'File path is required' })
  }
  
  const config = useRuntimeConfig()
  const token = config.githubToken || process.env.GITHUB_TOKEN
  if (!token) {
    throw createError({ statusCode: 500, message: 'GITHUB_TOKEN not configured' })
  }
  
  // Get project from database
  const proj = await getProject(projectId)
  
  if (!proj) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  
  // Get file content from GitHub
  const url = `https://api.github.com/repos/${proj.fullName}/contents/${filePath}?ref=${branch}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  })
  
  if (!res.ok) {
    throw createError({ statusCode: res.status, message: 'Failed to fetch file from GitHub' })
  }
  
  const data = await res.json()
  
  // Decode base64 content
  let content = ''
  if (data.content) {
    content = Buffer.from(data.content, 'base64').toString('utf-8')
  }
  
  return { content, name: data.name, path: data.path }
})
