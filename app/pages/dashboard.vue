<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const projects = ref([])
const availableRepos = ref([])
const loadingRepos = ref(false)
const adding = ref(null)
const removing = ref(null)

onMounted(async () => {
  await Promise.all([
    fetchProjects(),
    fetchAvailableRepos()
  ])
})

async function fetchProjects() {
  try {
    projects.value = await $fetch('/api/projects')
  } catch (e) {
    console.error('Failed to fetch projects:', e)
  }
}

async function fetchAvailableRepos() {
  loadingRepos.value = true
  try {
    availableRepos.value = await $fetch('/api/repos')
  } catch (e) {
    console.error('Failed to fetch repos:', e)
  } finally {
    loadingRepos.value = false
  }
}

async function addProject(fullName) {
  adding.value = fullName
  try {
    await $fetch('/api/projects', {
      method: 'POST',
      body: { fullName }
    })
    await Promise.all([
      fetchProjects(),
      fetchAvailableRepos()
    ])
  } catch (e) {
    alert(e.data?.message || 'Failed to add project')
  } finally {
    adding.value = null
  }
}

async function removeProject(projectId) {
  removing.value = projectId
  try {
    await $fetch(`/api/projects/${projectId}`, {
      method: 'DELETE'
    })
    await Promise.all([
      fetchProjects(),
      fetchAvailableRepos()
    ])
  } catch (e) {
    alert(e.data?.message || 'Failed to remove project')
  } finally {
    removing.value = null
  }
}

// Filter repos: only show repos NOT in projects
const filteredRepos = computed(() => {
  const projectFullNames = projects.value.map(p => p.fullName)
  return availableRepos.value.filter(repo => !projectFullNames.includes(repo.fullName))
})
</script>

<template>
  <div class="p-6">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button 
          @click="fetchAvailableRepos" 
          class="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Icon name="i-lucide-refresh-cw" class="w-4 h-4" :class="{ 'animate-spin': loadingRepos }" />
          Refresh Repos
        </button>
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- My Projects -->
        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 class="font-medium text-gray-900">My Projects ({{ projects.length }})</h2>
          </div>
          <div v-if="projects.length === 0" class="p-8 text-center text-gray-500">
            No projects yet. Add a repository from the Available Repos panel.
          </div>
          <div v-else class="divide-y divide-gray-200">
            <div 
              v-for="project in projects" 
              :key="project.id"
              class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <NuxtLink 
                :to="`/project/${project.id}`"
                class="flex-1 min-w-0"
              >
                <h3 class="font-medium text-gray-900">{{ project.name }}</h3>
                <p class="text-sm text-gray-500 truncate">{{ project.fullName }}</p>
              </NuxtLink>
              <div class="flex items-center gap-2 ml-4">
                <NuxtLink 
                  :to="`/project/${project.id}`"
                  class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Icon name="i-lucide-chevron-right" class="w-5 h-5" />
                </NuxtLink>
                <button 
                  @click="removeProject(project.id)"
                  :disabled="removing === project.id"
                  class="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Remove project"
                >
                  <Icon name="i-lucide-trash" class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Available Repos -->
        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 class="font-medium text-gray-900">Available Repos ({{ filteredRepos.length }})</h2>
          </div>
          <div v-if="loadingRepos" class="p-8 text-center text-gray-500">
            Loading repositories...
          </div>
          <div v-else-if="filteredRepos.length === 0" class="p-8 text-center text-gray-500">
            {{ projects.length > 0 ? 'All repos are already added as projects.' : 'No repositories found. Make sure your GITHUB_TOKEN has access to repos.' }}
          </div>
          <div v-else class="divide-y divide-gray-200">
            <div 
              v-for="repo in filteredRepos" 
              :key="repo.fullName"
              class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-900">{{ repo.fullName }}</span>
                  <span v-if="repo.private" class="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Private</span>
                </div>
                <p v-if="repo.description" class="text-sm text-gray-500 truncate mt-0.5">{{ repo.description }}</p>
              </div>
              <button 
                @click="addProject(repo.fullName)"
                :disabled="adding === repo.fullName"
                class="ml-4 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ adding === repo.fullName ? 'Adding...' : 'Add' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>