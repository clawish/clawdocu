// Sync comments to the forge (GitHub or Gitee) on the specified branch
import { getProject } from '~~/server/db/index'
import { forgeFetch } from '~~/server/utils/forge'
import { CLAW_GUIDE_TEMPLATE } from '~~/server/utils/claw-guide'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const body = await readBody(event)
  const { comments, branch } = body
  
  if (!branch) {
    throw createError({ statusCode: 400, message: 'Branch is required' })
  }
  
  // Get project from database
  const proj = await getProject(projectId)
  
  if (!proj) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  
  const owner = proj.fullName.split('/')[0]
  const repo = proj.fullName.split('/')[1]
  const commentPath = '.clawdocu-comments/comments.json'
  const clawdocuUrl = useRuntimeConfig().public?.clawdocuUrl || process.env.CLAWDOCU_URL || 'https://clawdocu.example.com'
  
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
        createdAt: c.createdAt,
        ...(c.followups && c.followups.length > 0 ? { followups: c.followups } : {})
      }))
      
      files.push({
        path: filePath,
        comments: cleanComments
      })
    }
  }
  
  const content = JSON.stringify({ files }, null, 2)
  const encodedContent = Buffer.from(content).toString('base64')
  
  // Check if comments.json exists on this branch to get SHA
  let sha = null
  let folderExists = false
  try {
    const checkRes = await forgeFetch(
      proj,
      `/repos/${owner}/${repo}/contents/${commentPath}?ref=${encodeURIComponent(branch)}`
    )
    if (checkRes.ok) {
      const data = await checkRes.json()
      sha = data.sha
      folderExists = true
    }
  } catch (e) {
    // File doesn't exist yet
  }
  
  // If this is the first save on this branch, create metadata.json and claw-guide.md first
  if (!folderExists) {
    // Create metadata.json
    const metadata = {
      projectId,
      clawdocuUrl,
      createdAt: new Date().toISOString()
    }
    const metadataContent = JSON.stringify(metadata, null, 2)
    const metadataEncoded = Buffer.from(metadataContent).toString('base64')
    
    // Create claw-guide.md with actual values
    const clawGuideContent = CLAW_GUIDE_TEMPLATE
      .replace(/{{CLAWDOCU_URL}}/g, clawdocuUrl)
      .replace(/{{PROJECT_ID}}/g, projectId)
    const clawGuideEncoded = Buffer.from(clawGuideContent).toString('base64')
    
    // Create both files on the branch
    await Promise.all([
      forgeFetch(proj, `/repos/${owner}/${repo}/contents/.clawdocu-comments/metadata.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Add ClawDocu metadata',
          content: metadataEncoded,
          branch
        })
      }),
      forgeFetch(proj, `/repos/${owner}/${repo}/contents/.clawdocu-comments/claw-guide.md`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Add ClawDocu guide for CLAWs',
          content: clawGuideEncoded,
          branch
        })
      })
    ])
  }
  
  // Create or update comments.json on the branch
  const putBody: any = {
    message: files.length > 0 ? 'Update comments' : 'Remove comments',
    content: encodedContent,
    branch
  }
  
  if (sha) {
    putBody.sha = sha
  }
  
  const res = await forgeFetch(proj, `/repos/${owner}/${repo}/contents/${commentPath}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody)
  })
  
  if (!res.ok) {
    const error = await res.text()
    console.error('Failed to sync comments:', error)
    throw createError({ statusCode: 500, message: 'Failed to sync comments' })
  }
  
  return { success: true, message: 'Comments synced' }
})
