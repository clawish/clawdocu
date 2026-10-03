import { createProject } from '~~/server/db'
import { forgeFetch } from '~~/server/utils/forge'
import { nanoid } from 'nanoid'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { fullName, source: rawSource } = body
  const source = rawSource === 'gitee' ? 'gitee' : 'github'

  // Block adding ClawDocu repo itself to avoid self-referential comments
  if (source === 'github' && fullName.toLowerCase() === 'clawish/clawdocu') {
    throw createError({
      statusCode: 400,
      message: 'Cannot add ClawDocu repository itself as a project'
    })
  }

  // Verify the repo exists and is accessible on the chosen forge
  const res = await forgeFetch({ source }, `/repos/${fullName}`)

  if (!res.ok) {
    throw createError({
      statusCode: 400,
      message: 'Repository not found or not accessible'
    })
  }

  const repo = await res.json()

  // Generate projectId
  const projectId = nanoid()

  // Create project in database with custom ID + source
  await createProject({
    id: projectId,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description ?? null,
    source,
  })

  // Note: .clawdocu-comments folder is created on the current branch
  // when the user first saves a comment, not when the repo is added.

  return { success: true, projectId }
})
