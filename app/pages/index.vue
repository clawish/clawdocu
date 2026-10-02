<script setup lang="ts">
definePageMeta({
  layout: false
})

const { t } = useI18n()
const localePath = useLocalePath()

const form = reactive({
  password: ''
})

const loading = ref(false)
const configured = ref(null)

onMounted(async () => {
  try {
    const data = await $fetch('/api/auth/status')
    console.log('[index onMounted] Auth status:', data)
    configured.value = data.configured
    if (data.loggedIn) {
      console.log('[index onMounted] Already logged in, redirecting to dashboard')
      window.location.href = localePath('/dashboard')
    }
  } catch (e) {
    console.error('Failed to check auth status:', e)
  }
})

async function login() {
  console.log('[login] Called with password:', form.password)
  loading.value = true
  
  try {
    const result = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { password: form.password }
    })
    console.log('[login] Success:', result)
    // Full page reload to dashboard
    window.location.href = localePath('/dashboard')
  } catch (e) {
    console.error('[login] Error:', e)
    alert(e.data?.message || t('auth.loginFailed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-lg border border-gray-200 p-8">
        <h1 class="text-2xl font-bold text-center text-red-600 mb-2">{{ t('common.clawdocu') }}</h1>
        <p class="text-center text-gray-500 mb-6">{{ t('auth.tagline') }}</p>
        
        <form @submit.prevent="login" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('auth.password') }}</label>
            <input 
              v-model="form.password" 
              type="password" 
              :placeholder="t('auth.adminPassword')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          
          <button 
            type="submit" 
            :disabled="loading"
            class="w-full py-2 px-4 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {{ loading ? t('auth.loggingIn') : t('auth.login') }}
          </button>
        </form>
        
        <div v-if="configured === false" class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p class="text-sm text-yellow-800">
            {{ t('auth.adminPasswordMissing', { code: 'ADMIN_PASSWORD' }) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>