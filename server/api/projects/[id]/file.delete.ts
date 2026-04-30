// Delete file from GitHub
import { getProject } from '~~/server/db/index'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const filePath = getQuery(event).path as string
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
  
  const owner = proj.fullName.split('/')[0]
  const repo = proj.fullName.split('/')[1]
  
  // First get the file SHA
  const getRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    }
  )
  
  if (!getRes.ok) {
    throw createError({ statusCode: getRes.status, message: 'File not found' })
  }
  
  const fileData = await getRes.json()
  
  // Delete the file
  const deleteRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Delete ${filePath}`,
        sha: fileData.sha,
        branch: branch
      })
    }
  )
  
  if (!deleteRes.ok) {
    const error = await deleteRes.text()
    throw createError({ statusCode: deleteRes.status, message: `Failed to delete: ${error}` })
  }
  
  return { success: true, message: 'File deleted' }
})
