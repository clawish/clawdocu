// Get raw file content (for images and binary files)
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
    const errorData = await res.json().catch(() => ({}))
    console.error(`[raw.get] GitHub API error: ${res.status}`, { 
      projectId, 
      filePath, 
      branch,
      error: errorData 
    })
    
    if (res.status === 404) {
      throw createError({ 
        statusCode: 404, 
        message: `File not found: ${filePath}` 
      })
    }
    
    throw createError({ 
      statusCode: res.status, 
      message: errorData.message || 'Failed to fetch file from GitHub' 
    })
  }
  
  const data = await res.json()
  
  // Determine MIME type from file extension
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon'
  }
  
  const mimeType = mimeTypes[ext] || 'application/octet-stream'
  
  // Set response headers
  setResponseHeaders(event, {
    'Content-Type': mimeType,
    'Cache-Control': 'public, max-age=3600'
  })
  
  // Return base64 content as binary
  if (data.content) {
    // GitHub returns base64-encoded content
    const buffer = Buffer.from(data.content, 'base64')
    return buffer
  }
  
  throw createError({ statusCode: 500, message: 'No content received from GitHub' })
})