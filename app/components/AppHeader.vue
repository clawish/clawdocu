<script setup lang="ts">
const props = defineProps<{
  project?: { name: string; fullName: string } | null
  showBack?: boolean
}>()

const { user, logout } = useAuth()
const config = useRuntimeConfig()
const version = config.public.version
</script>

<template>
  <header class="shrink-0 sticky top-0 z-50 bg-white border-b border-gray-200">
    <div class="flex items-center justify-between px-4 lg:px-6 h-14">
      <div class="flex items-center gap-6">
        <NuxtLink 
          v-if="showBack" 
          to="/dashboard" 
          class="text-gray-400 hover:text-gray-600"
        >
          <Icon name="i-lucide-arrow-left" class="w-5 h-5" />
        </NuxtLink>
        <NuxtLink to="/dashboard" class="text-xl font-bold text-red-600">
          {{ project?.name || 'ClawDocu' }}
        </NuxtLink>
        <nav class="hidden md:flex items-center gap-4">
          <NuxtLink 
            to="/dashboard" 
            class="text-sm text-gray-600 hover:text-red-600 transition-colors"
          >
            Dashboard
          </NuxtLink>
          <a 
            href="https://clawdocu.com/docs" 
            target="_blank"
            class="text-sm text-gray-600 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            Docs
            <Icon name="i-lucide-external-link" class="w-3 h-3" />
          </a>
        </nav>
      </div>
      
      <div class="flex items-center gap-3">
        <a 
          v-if="project?.fullName"
          :href="`https://github.com/${project.fullName}`" 
          target="_blank"
          class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <Icon name="i-lucide-github" class="w-4 h-4" />
          View on GitHub
        </a>
        
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
        
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">v{{ version }}</span>
          <a 
            href="https://github.com/clawish/clawdocu" 
            target="_blank"
            class="text-gray-400 hover:text-gray-600 transition-colors flex items-center"
          >
            <Icon name="i-lucide-github" class="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  </header>
</template>
