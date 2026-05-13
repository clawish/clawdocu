export const useAuth = () => {
  // Use useState for singleton state (SSR-safe, shared across components)
  const user = useState('authUser', () => null as any)
  const isAuthenticated = useState('authIsAuthenticated', () => false)
  const authChecked = useState('authChecked', () => false)
  const showPasswordInput = useState('authShowPasswordInput', () => false)
  const password = useState('authPassword', () => '')
  const authError = useState('authError', () => '')
  const returnUrl = useState('authReturnUrl', () => '')

  async function checkAuth() {
    try {
      user.value = await $fetch('/api/user')
      isAuthenticated.value = true
    } catch (e) {
      isAuthenticated.value = false
      showPasswordInput.value = true
    } finally {
      authChecked.value = true
    }
  }

  async function handleLogin() {
    authError.value = ''
    
    try {
      await $fetch('/api/auth/login', {
        method: 'POST',
        body: { password: password.value }
      })
      
      showPasswordInput.value = false
      isAuthenticated.value = true
      
      return true
    } catch (e: any) {
      authError.value = e.data?.message || 'Invalid password'
      return false
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return {
    user,
    isAuthenticated,
    authChecked,
    showPasswordInput,
    password,
    authError,
    returnUrl,
    checkAuth,
    handleLogin,
    logout,
  }
}
