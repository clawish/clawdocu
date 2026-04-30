<script setup lang="ts">
definePageMeta({
  layout: false
})

const form = reactive({
  password: ''
})

const loading = ref(false)
const configured = ref(null)

onMounted(async () => {
  try {
    const data = await $fetch('/api/auth/status')
    configured.value = data.configured
    if (data.loggedIn) {
      navigateTo('/dashboard')
    }
  } catch (e) {
    console.error('Failed to check auth status:', e)
  }
})

async function login() {
  loading.value = true
  
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { password: form.password }
    })
    navigateTo('/dashboard')
  } catch (e) {
    alert(e.data?.message || 'Login failed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-lg border border-gray-200 p-8">
        <h1 class="text-2xl font-bold text-center text-red-600 mb-2">ClawDocu</h1>
        <p class="text-center text-gray-500 mb-6">Self-hosted documentation</p>
        
        <form @submit.prevent="login" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              v-model="form.password" 
              type="password" 
              placeholder="Enter admin password"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          
          <button 
            type="submit" 
            :disabled="loading"
            class="w-full py-2 px-4 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {{ loading ? 'Logging in...' : 'Login' }}
          </button>
        </form>
        
        <div v-if="configured === false" class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p class="text-sm text-yellow-800">
            ⚠️ Admin password not configured. Set <code class="bg-yellow-100 px-1 rounded">ADMIN_PASSWORD</code> environment variable.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
