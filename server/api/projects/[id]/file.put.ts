// Save file content to forge (GitHub or Gitee by project source)
import { getProject } from '~~/server/db/index'
import { projectForge } from '~~/server/utils/forge'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const body = await readBody(event)
  const { path: filePath, content, sha, branch, message } = body

  if (!filePath || content === undefined) {
    throw createError({ statusCode: 400, message: 'File path and content are required' })
  }

  if (!branch) {
    throw createError({ statusCode: 400, message: 'Branch is required' })
  }

  const proj = await getProject(projectId)
  if (!proj) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  const forge = projectForge(proj)

  const encodedContent = Buffer.from(content).toString('base64')
  const commitMessage = message || `Update ${filePath}`

  const putBody: any = {
    message: commitMessage,
    content: encodedContent,
    branch,
  }
  if (sha) putBody.sha = sha

  const res = await forgeFetch(proj, `/repos/${proj.fullName}/contents/${filePath}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error('[file.put] Forge API error:', error)
    throw createError({ statusCode: res.status, message: 'Failed to save file to forge' })
  }

  const data = await res.json()
  return { success: true, sha: data.content?.sha, commit: data.commit?.sha }
})
