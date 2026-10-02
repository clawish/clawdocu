export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip auth check on server-side to avoid hydration mismatch
  if (import.meta.server) {
    return
  }

  // Check auth status via API (httpOnly cookie can't be read by JS)
  const localePath = useLocalePath()
  try {
    const status = await $fetch('/api/auth/status')
    if (!status.loggedIn) {
      return navigateTo(localePath('/'))
    }
  } catch (e) {
    return navigateTo(localePath('/'))
  }
})
