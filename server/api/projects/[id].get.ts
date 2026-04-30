import { getProject } from '~~/server/db'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  
  const project = await getProject(projectId!)
  
  if (!project) {
    throw createError({
      statusCode: 404,
      message: 'Project not found'
    })
  }
  
  return project
})
