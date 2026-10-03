import { getProject } from '~~/server/db/index'
import { projectForge } from '~~/server/utils/forge'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const filePath = getQuery(event).path as string || ''
  const branch = getQuery(event).branch as string || 'main'
  
  if (!filePath) {
    throw createError({ statusCode: 400, message: 'File path is required' })
  }
  
  // Get project from database
  const proj = await getProject(projectId)
  
  if (!proj) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  
  // Get file content (GitHub or Gitee by project source)
  const res = await forgeFetch(proj, `/repos/${proj.fullName}/contents/${filePath}?ref=${branch}`)
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    console.error(`[file.get] Forge API error: ${res.status}`, { 
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
      message: errorData.message || 'Failed to fetch file from forge' 
    })
  }
  
  const data = await res.json()
  
  // Decode base64 content
  let content = ''
  if (data.content) {
    content = Buffer.from(data.content, 'base64').toString('utf-8')
  }
  
  return { content, name: data.name, path: data.path, sha: data.sha }
})