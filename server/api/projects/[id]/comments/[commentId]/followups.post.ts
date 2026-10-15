// Add a followup to a comment on the specified branch
import { getProject } from '~~/server/db/index'
import { forgeFetch, fetchForgeTextFile } from '~~/server/utils/forge'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const commentId = event.context.params?.commentId
  const body = await readBody(event)
  const { author, body: followupBody, branch } = body

  if (!commentId || !followupBody?.trim()) {
    throw createError({ statusCode: 400, message: 'commentId and body are required' })
  }

  if (!branch) {
    throw createError({ statusCode: 400, message: 'Branch is required' })
  }

  const proj = await getProject(projectId)
  if (!proj) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  const [owner, repo] = proj.fullName.split('/')
  const commentPath = '.clawdocu-comments/comments.json'

  // Fetch current comments from the specified branch
  let sha: string | null = null
  let parsed: any = { files: [] }

  try {
    const file = await fetchForgeTextFile(proj, owner, repo, commentPath, branch)
    if (file) {
      sha = file.sha || null
      parsed = JSON.parse(file.text)
    }
  } catch (e) {
    // File doesn't exist yet / unreadable — start from empty
  }

  // Find the comment and add followup
  const followup = {
    id: Date.now().toString(),
    author: author || 'user',
    body: followupBody.trim(),
    createdAt: new Date().toISOString()
  }

  let found = false
  for (const file of parsed.files || []) {
    for (const comment of file.comments || []) {
      if (comment.id === commentId) {
        if (!comment.followups) comment.followups = []
        comment.followups.push(followup)
        found = true
        break
      }
    }
    if (found) break
  }

  if (!found) {
    throw createError({ statusCode: 404, message: 'Comment not found' })
  }

  // Write back to the forge on the specified branch
  const encodedContent = Buffer.from(JSON.stringify(parsed, null, 2)).toString('base64')
  const putBody: any = {
    message: `Add followup to comment ${commentId}`,
    content: encodedContent,
    branch
  }
  if (sha) putBody.sha = sha

  const putRes = await forgeFetch(proj, `/repos/${owner}/${repo}/contents/${commentPath}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody)
  })

  if (!putRes.ok) {
    const error = await putRes.text()
    console.error('Failed to add followup:', error)
    throw createError({ statusCode: 500, message: 'Failed to add followup' })
  }

  return { success: true, followup }
})
