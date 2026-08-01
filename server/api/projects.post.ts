import { createProject } from '~~/server/db'
import { nanoid } from 'nanoid'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { fullName } = body
  
  // Block adding ClawDocu repo itself to avoid self-referential comments
  if (fullName.toLowerCase() === 'clawish/clawdocu') {
    throw createError({
      statusCode: 400,
      message: 'Cannot add ClawDocu repository itself as a project'
    })
  }
  
  // Get repo info from GitHub
  const config = useRuntimeConfig()
  const token = config.githubToken || process.env.GITHUB_TOKEN
  
  if (!token) {
    throw createError({
      statusCode: 500,
      message: 'GITHUB_TOKEN not configured'
    })
  }
  
  const res = await fetch(`https://api.github.com/repos/${fullName}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  })
  
  if (!res.ok) {
    throw createError({
      statusCode: 400,
      message: 'Repository not found or not accessible'
    })
  }
  
  const repo = await res.json()
  
  // Generate projectId
  const projectId = nanoid()
  
  // Create project in database with custom ID
  await createProject({
    id: projectId,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
  })
  
  // Note: .clawdocu-comments folder is created on the current branch
  // when the user first saves a comment, not when the repo is added.
  
  return { success: true, projectId }
})