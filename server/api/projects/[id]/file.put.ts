// Save file content to GitHub
import { getProject } from '~~/server/db/index'

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

  const config = useRuntimeConfig()
  const token = config.githubToken || process.env.GITHUB_TOKEN
  if (!token) {
    throw createError({ statusCode: 500, message: 'GITHUB_TOKEN not configured' })
  }

  const proj = await getProject(projectId)
  if (!proj) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  const owner = proj.fullName.split('/')[0]
  const repo = proj.fullName.split('/')[1]

  const encodedContent = Buffer.from(content).toString('base64')
  const commitMessage = message || `Update ${filePath}`

  const putBody: any = {
    message: commitMessage,
    content: encodedContent,
    branch,
  }
  if (sha) putBody.sha = sha

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(putBody),
    }
  )

  if (!res.ok) {
    const error = await res.text()
    console.error('[file.put] GitHub API error:', error)
    throw createError({ statusCode: res.status, message: 'Failed to save file to GitHub' })
  }

  const data = await res.json()
  return { success: true, sha: data.content?.sha, commit: data.commit?.sha }
})
