<script setup lang="ts">
const route = useRoute()
const projectId = computed(() => route.params.id as string)

const project = ref(null)
const user = ref(null)

onMounted(async () => {
  if (projectId.value) {
    await loadProject()
  }
  await fetchUser()
})

watch(projectId, async (newId) => {
  if (newId) {
    await loadProject()
  }
})

async function loadProject() {
  try {
    project.value = await $fetch(`/api/projects/${projectId.value}`)
  } catch (e) {
    console.error('Failed to load project:', e)
  }
}

async function fetchUser() {
  try {
    user.value = await $fetch('/api/user')
  } catch (e) {
    // Not logged in or error
  }
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  navigateTo('/login')
}
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- Top Header Bar (same as dashboard) -->
    <header class="shrink-0 sticky top-0 z-50 bg-white border-b border-gray-200">
      <div class="flex items-center justify-between px-4 lg:px-6 h-14">
        <div class="flex items-center gap-6">
          <NuxtLink to="/dashboard" class="text-xl font-bold text-red-600">ClawDocu</NuxtLink>
          <nav class="hidden md:flex items-center gap-4">
            <NuxtLink 
              to="/dashboard" 
              class="text-sm text-gray-600 hover:text-red-600 transition-colors"
            >
              Dashboard
            </NuxtLink>
          </nav>
        </div>
        
        <div class="flex items-center gap-3">
          <div v-if="user" class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <span class="text-sm font-medium text-red-600">{{ user.login?.charAt(0)?.toUpperCase() }}</span>
            </div>
            <span class="hidden sm:block text-sm text-gray-700">{{ user.name || user.login }}</span>
          </div>
          
          <button 
            @click="logout" 
            class="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
    <slot :project="project" />
  </div>
</template>
