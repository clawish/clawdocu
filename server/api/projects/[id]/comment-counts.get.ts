// Get comment counts for all files in a project
import { getProject } from '~~/server/db/index'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  
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
  const commentPath = '.clawdocu-comments/comments.json'
  
  // Try to fetch comments.json
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${commentPath}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    )
    
    if (!res.ok) {
      return { counts: {} }
    }
    
    const data = await res.json()
    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    const parsed = JSON.parse(content)
    
    // Build counts from files array
    const counts: Record<string, number> = {}
    for (const file of parsed.files || []) {
      counts[file.path] = (file.comments || []).length
    }
    
    return { counts }
  } catch (e) {
    console.error('Failed to load comment counts:', e)
    return { counts: {} }
  }
})
