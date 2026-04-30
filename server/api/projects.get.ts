import { getProjects } from '~~/server/db'

export default defineEventHandler(async (event) => {
  return await getProjects()
})
