import { getDatabase } from '~~/server/db/index'

export default defineEventHandler(async (event) => {
  // Add db to context
  event.context.db = getDatabase()
  
  const url = getRequestURL(event)
  
  // Skip auth for login, auth status, static assets, and public pages
  if (
    url.pathname === '/api/auth/login' || 
    url.pathname === '/api/auth/status' ||
    url.pathname.startsWith('/_nuxt') || 
    url.pathname === '/' ||
    url.pathname === '/login'
  ) {
    return
  }
  
  // Allow page requests (frontend handles auth)
  if (!url.pathname.startsWith('/api/')) {
    return
  }
  
  // For API routes, require auth
  const session = getCookie(event, 'admin_session')
  const adminPassword = process.env.ADMIN_PASSWORD
  
  if (!adminPassword) {
    throw createError({ statusCode: 500, message: 'ADMIN_PASSWORD not configured' })
  }
  
  if (!session || session !== adminPassword) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  event.context.isAdmin = true
})
