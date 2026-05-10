// Rename file/folder in GitHub
import { getProject } from '~~/server/db/index'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const body = await readBody(event)
  const { oldPath, newPath, branch = 'main' } = body
  
  if (!oldPath || !newPath) {
    throw createError({ statusCode: 400, message: 'oldPath and newPath are required' })
  }
  
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
  
  // Get the file/folder info
  const getRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${oldPath}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    }
  )
  
  if (!getRes.ok) {
    throw createError({ statusCode: getRes.status, message: 'File not found' })
  }
  
  const itemData = await getRes.json()
  
  // Check if it's a directory (array of items)
  if (Array.isArray(itemData)) {
    // It's a directory - rename all files inside
    // Get the tree for the branch
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    )
    
    if (!treeRes.ok) {
      throw createError({ statusCode: treeRes.status, message: 'Failed to get repository tree' })
    }
    
    const treeData = await treeRes.json()
    
    // Filter files that are inside the old directory
    const filesToRename = treeData.tree.filter((item: any) => 
      item.type === 'blob' && item.path.startsWith(oldPath + '/')
    )
    
    if (filesToRename.length === 0) {
      throw createError({ statusCode: 400, message: 'Directory is empty or not found' })
    }
    
    // Get the latest commit SHA
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    )
    
    if (!refRes.ok) {
      throw createError({ statusCode: refRes.status, message: 'Failed to get branch ref' })
    }
    
    const refData = await refRes.json()
    const baseTreeSha = refData.object.sha
    
    // Create new tree with renamed files AND delete old files
    const newTree = [
      // Add renamed files
      ...filesToRename.map((item: any) => ({
        path: item.path.replace(oldPath + '/', newPath + '/'),
        mode: item.mode,
        type: item.type,
        sha: item.sha
      })),
      // Delete old files (set sha to null)
      ...filesToRename.map((item: any) => ({
        path: item.path,
        mode: item.mode,
        type: item.type,
        sha: null
      }))
    ]
    
    // Create a new tree
    const createTreeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: newTree
        })
      }
    )
    
    if (!createTreeRes.ok) {
      const error = await createTreeRes.text()
      throw createError({ statusCode: createTreeRes.status, message: `Failed to create tree: ${error}` })
    }
    
    const newTreeData = await createTreeRes.json()
    
    // Create a commit
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Rename ${oldPath} to ${newPath}`,
          tree: newTreeData.sha,
          parents: [baseTreeSha]
        })
      }
    )
    
    if (!commitRes.ok) {
      const error = await commitRes.text()
      throw createError({ statusCode: commitRes.status, message: `Failed to create commit: ${error}` })
    }
    
    const commitData = await commitRes.json()
    
    // Update the branch ref
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sha: commitData.sha
        })
      }
    )
    
    if (!updateRefRes.ok) {
      const error = await updateRefRes.text()
      throw createError({ statusCode: updateRefRes.status, message: `Failed to update branch: ${error}` })
    }
    
    return { success: true, message: 'Directory renamed' }
  }
  
  // It's a file
  if (!itemData.content) {
    throw createError({ statusCode: 400, message: 'File content not available (might be too large)' })
  }
  
  // Create file at new location
  const createRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${newPath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Rename ${oldPath} to ${newPath}`,
        content: itemData.content,
        branch: branch
      })
    }
  )
  
  if (!createRes.ok) {
    const error = await createRes.text()
    throw createError({ statusCode: createRes.status, message: `Failed to create: ${error}` })
  }
  
  // Delete the old file
  const deleteRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${oldPath}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Rename ${oldPath} to ${newPath}`,
        sha: itemData.sha,
        branch: branch
      })
    }
  )
  
  if (!deleteRes.ok) {
    const error = await deleteRes.text()
    throw createError({ statusCode: deleteRes.status, message: `Failed to delete old file: ${error}` })
  }
  
  return { success: true, message: 'File renamed' }
})