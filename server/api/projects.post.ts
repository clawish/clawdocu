import { createProject } from '~~/server/db'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { fullName } = body
  
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
  
  await createProject({
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
  })

  // Seed .clawdocu/README.md into the repo if it doesn't exist
  const owner = fullName.split('/')[0]
  const repoName = fullName.split('/')[1]
  
  try {
    // Check if .clawdocu/README.md already exists
    const checkRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/.clawdocu/README.md`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    )
    
    if (!checkRes.ok) {
      // File doesn't exist — create it
      const readmePath = resolve(process.cwd(), '.clawdocu/README.md')
      const readmeContent = readFileSync(readmePath, 'utf-8')
      const encodedContent = Buffer.from(readmeContent).toString('base64')
      
      await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/.clawdocu/README.md`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: 'Initialize .clawdocu with AI agent guide',
            content: encodedContent
          })
        }
      )
    }
  } catch (e) {
    // Non-critical — don't fail project creation if seeding fails
    console.error('Failed to seed .clawdocu/README.md:', e)
  }
  
  return { success: true }
})