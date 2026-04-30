<script setup lang="ts">
const props = defineProps<{
  project?: { name: string; fullName: string } | null
  showBack?: boolean
}>()

const route = useRoute()
const projectId = computed(() => route.params.id as string)
</script>

<template>
  <header class="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <NuxtLink 
          v-if="showBack" 
          to="/dashboard" 
          class="text-gray-400 hover:text-gray-600"
        >
          <Icon name="i-lucide-arrow-left" class="w-5 h-5" />
        </NuxtLink>
        <h1 class="text-lg font-semibold text-gray-900">
          {{ project?.name || 'ClawDocu' }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <a 
          v-if="project?.fullName"
          :href="`https://github.com/${project.fullName}`" 
          target="_blank"
          class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <Icon name="i-lucide-github" class="w-4 h-4" />
          View on GitHub
        </a>
      </div>
    </div>
  </header>
</template>
