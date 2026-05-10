import { deleteProject } from '~~/server/db'

export default defineEventHandler(async (event) => {
  const projectId = event.context.params?.id
  
  if (!projectId) {
    throw createError({
      statusCode: 400,
      message: 'Project ID is required'
    })
  }
  
  await deleteProject(projectId)
  
  return { success: true }
})
