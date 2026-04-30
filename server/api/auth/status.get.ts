export default defineEventHandler(async (event) => {
  try {
    // Check if logged in
    const session = getCookie(event, 'admin_session')
    const adminPassword = process.env.ADMIN_PASSWORD
    
    if (!adminPassword) {
      return { configured: false, loggedIn: false }
    }
    
    return { 
      configured: true, 
      loggedIn: session === adminPassword 
    }
  } catch (error) {
    console.error('[Auth Status] Error:', error)
    return { configured: false, loggedIn: false }
  }
})
