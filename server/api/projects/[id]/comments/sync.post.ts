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
  
  // Track files that need to be deleted (empty comments)
  const filesToDelete: string[] = []
  
  // Process each file's comments
  for (const [filePath, fileComments] of Object.entries(comments)) {
    const commentPath = `.clawdocu-comments/${filePath}.json`
    
    // If no comments for this file, mark for deletion
    if (!Array.isArray(fileComments) || fileComments.length === 0) {
      filesToDelete.push(commentPath)
      continue
    }
    
    // Clean up comments - remove visualTop and ensure proper format
    const cleanComments = fileComments.map(c => ({
      id: c.id,
      selectedText: c.selectedText,
      text: c.text,
      lineNumber: c.lineNumber,
      createdAt: c.createdAt
    }))
    
    const content = JSON.stringify({ comments: cleanComments }, null, 2)
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
    const putBody = {
      message: `Update comments for ${filePath}`,
      content: encodedContent,
      ...(sha && { sha })
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
      console.error(`Failed to sync ${filePath}:`, error)
    }
  }
  
  // Delete files with no comments
  for (const commentPath of filesToDelete) {
    // Get SHA first
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
        const sha = data.sha
        
        // Delete the file
        const deleteBody = {
          message: `Remove comments file ${commentPath}`,
          sha: sha
        }
        
        const delRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${commentPath}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(deleteBody)
          }
        )
        
        if (!delRes.ok) {
          const error = await delRes.text()
          console.error(`Failed to delete ${commentPath}:`, error)
        }
      }
    } catch (e) {
      // File doesn't exist, nothing to delete
    }
  }
  
  return { success: true, message: 'Comments synced' }
})
