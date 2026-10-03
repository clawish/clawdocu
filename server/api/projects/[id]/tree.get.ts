// Get project file tree from forge (GitHub or Gitee by project source)
import { getProject } from '~~/server/db/index'
import { forgeFetch } from '~~/server/utils/forge'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  const branchQuery = getQuery(event).branch as string | undefined
  
  // Get project from database
  const proj = await getProject(projectId)
  
  if (!proj) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }
  
  const owner = proj.fullName.split('/')[0]
  const repo = proj.fullName.split('/')[1]
  
  // Get repo info to determine default branch
  const repoRes = await forgeFetch(proj, `/repos/${owner}/${repo}`)
  
  if (!repoRes.ok) {
    throw createError({ statusCode: repoRes.status, message: 'Failed to fetch repo info from forge' })
  }
  
  const repoData = await repoRes.json()
  const defaultBranch = repoData.default_branch || 'main'
  const branch = branchQuery || defaultBranch
  
  // Get tree
  const res = await forgeFetch(proj, `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`)
  
  if (!res.ok) {
    throw createError({ statusCode: res.status, message: 'Failed to fetch tree from forge' })
  }
  
  const data = await res.json()
  
  // Convert flat tree to nested structure
  const tree = buildTree(data.tree)
  
  // Get branches
  const branchesRes = await forgeFetch(proj, `/repos/${owner}/${repo}/branches`)
  
  let branches = [defaultBranch]
  if (branchesRes.ok) {
    const branchesData = await branchesRes.json()
    branches = branchesData.map((b: any) => b.name)
  }
  
  return { tree, branches, defaultBranch }
})

function buildTree(items: any[]) {
  const root = []
  const map = new Map()
  
  // Sort by path
  items.sort((a, b) => a.path.localeCompare(b.path))
  
  for (const item of items) {
    const parts = item.path.split('/')
    const name = parts.pop()
    const parentPath = parts.join('/')
    
    const node = {
      name,
      path: item.path,
      type: item.type === 'tree' ? 'dir' : 'file',
      children: item.type === 'tree' ? [] : undefined
    }
    
    map.set(item.path, node)
    
    if (parentPath) {
      const parent = map.get(parentPath)
      if (parent && parent.children) {
        parent.children.push(node)
      }
    } else {
      root.push(node)
    }
  }
  
  return root
}
