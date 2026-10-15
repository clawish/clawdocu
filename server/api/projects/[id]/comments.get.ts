// Get comments for a file from the forge (GitHub or Gitee by project source)
import { getProject } from '~~/server/db/index'
import { fetchForgeTextFile } from '~~/server/utils/forge'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const filePath = getQuery(event).path as string | undefined
  const branch = (getQuery(event).branch as string) || 'main'
  
  // Get project from database
  const proj = await getProject(projectId)
  
  if (!proj) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  
  const [owner, repo] = proj.fullName.split('/')
  const commentPath = '.clawdocu-comments/comments.json'
  
  // Try to fetch comments from the forge on the specified branch
  try {
    const file = await fetchForgeTextFile(proj, owner, repo, commentPath, branch)
    if (!file) {
      return filePath ? { comments: [] } : { comments: {} }
    }
    
    const parsed = JSON.parse(file.text)
    
    // If filePath is specified, return comments for that file only
    if (filePath) {
      const fileEntry = parsed.files?.find((f: any) => f.path === filePath)
      return { comments: fileEntry?.comments || [] }
    }
    
    // Otherwise return all comments grouped by file
    const allComments: Record<string, any[]> = {}
    for (const f of parsed.files || []) {
      allComments[f.path] = f.comments || []
    }
    
    return { comments: allComments }
  } catch (e) {
    return { comments: filePath ? [] : {} }
  }
})