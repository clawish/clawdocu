// Get comments for a file from the forge (GitHub or Gitee by project source)
import { getProject } from '~~/server/db/index'
import { forgeFetch } from '~~/server/utils/forge'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const filePath = getQuery(event).path as string | undefined
  const branch = (getQuery(event).branch as string) || 'main'
  
  // Get project from database
  const proj = await getProject(projectId)
  
  if (!proj) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  
  const owner = proj.fullName.split('/')[0]
  const repo = proj.fullName.split('/')[1]
  const commentPath = '.clawdocu-comments/comments.json'
  
  // Try to fetch comments from the forge on the specified branch
  try {
    const res = await forgeFetch(
      proj,
      `/repos/${owner}/${repo}/contents/${commentPath}?ref=${encodeURIComponent(branch)}`
    )
    
    if (!res.ok) {
      return { comments: [] }
    }
    
    const data = await res.json()
    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    const parsed = JSON.parse(content)
    
    // If filePath is specified, return comments for that file only
    if (filePath) {
      const fileEntry = parsed.files?.find((f: any) => f.path === filePath)
      return { comments: fileEntry?.comments || [] }
    }
    
    // Otherwise return all comments grouped by file
    const allComments: Record<string, any[]> = {}
    for (const file of parsed.files || []) {
      allComments[file.path] = file.comments || []
    }
    
    return { comments: allComments }
  } catch (e) {
    return { comments: [] }
  }
})