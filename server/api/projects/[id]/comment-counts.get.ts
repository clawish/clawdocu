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
  
  // Get tree to find all .clawdocu-comments files
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    }
  )
  
  if (!treeRes.ok) {
    return { counts: {} }
  }
  
  const treeData = await treeRes.json()
  
  // Find all .clawdocu-comments/*.json files
  const commentFiles = treeData.tree.filter(item => 
    item.path.startsWith('.clawdocu-comments/') && item.path.endsWith('.json')
  )
  
  // Fetch each comment file and count comments
  const counts: Record<string, number> = {}
  
  await Promise.all(commentFiles.map(async (file) => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      )
      
      if (res.ok) {
        const data = await res.json()
        const content = Buffer.from(data.content, 'base64').toString('utf-8')
        const parsed = JSON.parse(content)
        
        // Extract original file path from .clawdocu-comments/path/to/file.json
        const originalPath = file.path.replace('.clawdocu-comments/', '').replace('.json', '')
        counts[originalPath] = (parsed.comments || []).length
      }
    } catch (e) {
      // Skip files that can't be parsed
    }
  }))
  
  return { counts }
})
