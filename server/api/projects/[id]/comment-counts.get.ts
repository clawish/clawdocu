// Get comment counts for all files in a project
import { getProject } from '~~/server/db/index'
import { forgeFetch } from '~~/server/utils/forge'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const branch = (getQuery(event).branch as string) || 'main'
  
  // Get project from database
  const proj = await getProject(projectId)
  
  if (!proj) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  
  const owner = proj.fullName.split('/')[0]
  const repo = proj.fullName.split('/')[1]
  const commentPath = '.clawdocu-comments/comments.json'
  
  // Try to fetch comments.json from the specified branch
  try {
    const res = await forgeFetch(
      proj,
      `/repos/${owner}/${repo}/contents/${commentPath}?ref=${encodeURIComponent(branch)}`
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