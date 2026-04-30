import { getDatabase } from '~~/server/db/index'

export default defineEventHandler(async (event) => {
  // Add db to context
  event.context.db = getDatabase()
  
  try {
    const url = getRequestURL(event)
    
    // Skip auth for login, auth status, and static assets
    if (
      url.pathname === '/api/auth/login' || 
      url.pathname === '/api/auth/status' ||
      url.pathname.startsWith('/_nuxt') || 
      url.pathname === '/' ||
      url.pathname === '/login'
    ) {
      return
    }
    
    // Check for admin session cookie
    const session = getCookie(event, 'admin_session')
    const adminPassword = process.env.ADMIN_PASSWORD
    
    if (!adminPassword) {
      throw createError({
        statusCode: 500,
        message: 'ADMIN_PASSWORD not configured'
      })
    }
    
    if (!session || session !== adminPassword) {
      throw createError({
        statusCode: 401,
        message: 'Unauthorized'
      })
    }
    
    event.context.isAdmin = true
  } catch (error) {
    throw error
  }
})
