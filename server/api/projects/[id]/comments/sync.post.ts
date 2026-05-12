// Sync comments to git repository
import { getProject } from '~~/server/db/index'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const body = await readBody(event)
  const { comments } = body
  
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
  const commentPath = '.clawdocu/comments.json'
  
  // Convert from Record<string, Comment[]> to files array format
  const files: any[] = []
  
  for (const [filePath, fileComments] of Object.entries(comments)) {
    if (Array.isArray(fileComments) && fileComments.length > 0) {
      // Clean up comments - remove visualTop and ensure proper format
      const cleanComments = fileComments.map(c => ({
        id: c.id,
        lineNumber: c.lineNumber,
        selectedText: c.selectedText,
        text: c.text,
        createdAt: c.createdAt
      }))
      
      files.push({
        path: filePath,
        comments: cleanComments
      })
    }
  }
  
  const content = JSON.stringify({ files }, null, 2)
  const encodedContent = Buffer.from(content).toString('base64')
  
  // Check if file exists to get SHA
  let sha = null
  try {
    const checkRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${commentPath}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    )
    if (checkRes.ok) {
      const data = await checkRes.json()
      sha = data.sha
    }
  } catch (e) {
    // File doesn't exist yet
  }
  
  // Create or update file
  const putBody: any = {
    message: files.length > 0 ? 'Update comments' : 'Remove comments',
    content: encodedContent
  }
  
  if (sha) {
    putBody.sha = sha
  }
  
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${commentPath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(putBody)
    }
  )
  
  if (!res.ok) {
    const error = await res.text()
    console.error('Failed to sync comments:', error)
    throw createError({ statusCode: 500, message: 'Failed to sync comments' })
  }
  
  return { success: true, message: 'Comments synced' }
})
