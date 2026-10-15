// Get comment counts for all files in a project
import { getProject } from '~~/server/db/index'
import { fetchForgeTextFile } from '~~/server/utils/forge'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const branch = (getQuery(event).branch as string) || 'main'
  
  // Get project from database
  const proj = await getProject(projectId)
  
  if (!proj) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  
  const [owner, repo] = proj.fullName.split('/')
  const commentPath = '.clawdocu-comments/comments.json'
  
  try {
    const file = await fetchForgeTextFile(proj, owner, repo, commentPath, branch)
    if (!file) {
      return { counts: {} }
    }
    
    const parsed = JSON.parse(file.text)
    
    // Build counts from files array
    const counts: Record<string, number> = {}
    for (const f of parsed.files || []) {
      counts[f.path] = (f.comments || []).length
    }
    
    return { counts }
  } catch (e) {
    console.error('Failed to load comment counts:', e)
    return { counts: {} }
  }
})