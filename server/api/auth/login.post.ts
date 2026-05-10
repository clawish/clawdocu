export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { password } = body
  
  const adminPassword = process.env.ADMIN_PASSWORD
  
  if (!adminPassword) {
    throw createError({
      statusCode: 500,
      message: 'ADMIN_PASSWORD not configured'
    })
  }
  
  if (password === adminPassword) {
    setCookie(event, 'admin_session', adminPassword, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/'
    })
    return { success: true }
  }
  
  throw createError({
    statusCode: 401,
    message: 'Invalid password'
  })
})
