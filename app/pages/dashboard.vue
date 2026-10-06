<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const { t } = useI18n()
const localePath = useLocalePath()

const projects = ref([])
const availableRepos = ref([])
const loadingRepos = ref(false)
const adding = ref(null)
const removing = ref(null)

// Repo source: 'github' | 'gitee'. Toggle only shows when GITEE_TOKEN is
// configured (from /api/sources). Remembers the last choice per session.
const repoSource = ref('github')
const sources = ref([])

onMounted(async () => {
  await Promise.all([
    fetchProjects(),
    fetchAvailableRepos(),
    fetchSources()
  ])
})

async function fetchSources() {
  try {
    const data = await $fetch('/api/sources')
    sources.value = data.sources || []
    // Restore last used source if it's configured
    const saved = sessionStorage.getItem('clawdocu_repo_source')
    if (saved && sources.value.find(s => s.id === saved && s.configured)) {
      repoSource.value = saved
      await fetchAvailableRepos()
    }
  } catch (e) {
    console.error('Failed to fetch sources:', e)
  }
}

async function switchSource(source) {
  if (repoSource.value === source) return
  repoSource.value = source
  sessionStorage.setItem('clawdocu_repo_source', source)
  await fetchAvailableRepos()
}

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
    availableRepos.value = await $fetch(`/api/repos?source=${repoSource.value}`)
  } catch (e) {
    console.error('Failed to fetch repos:', e)
    availableRepos.value = []
  } finally {
    loadingRepos.value = false
  }
}

async function addProject(fullName, source) {
  adding.value = fullName
  try {
    await $fetch('/api/projects', {
      method: 'POST',
      body: { fullName, source: source || repoSource.value }
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

// Filter repos: only show repos NOT in projects (matched per source, so the
// same fullName on GitHub and Gitee can coexist as separate projects)
const filteredRepos = computed(() => {
  const existing = new Set(projects.value.map(p => `${p.source || 'github'}:${p.fullName}`))
  return availableRepos.value.filter(repo => !existing.has(`${repo.source}:${repo.fullName}`))
})
</script>

<template>
  <div class="p-6">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">{{ t('dashboard.title') }}</h1>
        <button 
          @click="fetchAvailableRepos" 
          class="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Icon name="i-lucide-refresh-cw" class="w-4 h-4" :class="{ 'animate-spin': loadingRepos }" />
          {{ t('common.refreshRepos') }}
        </button>
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- My Projects -->
        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-12rem)]">
          <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
            <h2 class="font-medium text-gray-900">{{ t('dashboard.myProjects', { count: projects.length }) }}</h2>
          </div>
          <div v-if="projects.length === 0" class="p-8 text-center text-gray-500">
            {{ t('dashboard.noProjects') }}
          </div>
          <div v-else class="divide-y divide-gray-200 overflow-y-auto">
            <div 
              v-for="project in projects" 
              :key="project.id"
              class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <NuxtLink 
                :to="localePath(`/project/${project.id}`)"
                class="flex-1 min-w-0"
              >
                <h3 class="font-medium text-gray-900 flex items-center gap-2">
                  {{ project.name }}
                  <span v-if="(project.source || 'github') === 'gitee'" class="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-semibold">Gitee</span>
                </h3>
                <p class="text-sm text-gray-500 truncate">{{ project.fullName }}</p>
              </NuxtLink>
              <div class="flex items-center gap-2 ml-4">
                <NuxtLink 
                  :to="localePath(`/project/${project.id}`)"
                  class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Icon name="i-lucide-chevron-right" class="w-5 h-5" />
                </NuxtLink>
                <button 
                  @click="removeProject(project.id)"
                  :disabled="removing === project.id"
                  class="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  :title="t('dashboard.removeProject')"
                >
                  <Icon name="i-lucide-trash" class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Available Repos -->
        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-12rem)]">
          <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 shrink-0 flex items-center justify-between">
            <h2 class="font-medium text-gray-900">{{ t('dashboard.availableRepos', { count: filteredRepos.length }) }}</h2>
            <!-- Source toggle: only when Gitee is configured -->
            <div v-if="sources.find(s => s.id === 'gitee')?.configured" class="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button
                @click="switchSource('github')"
                class="px-2.5 py-1 transition-colors"
                :class="repoSource === 'github' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'"
              >GitHub</button>
              <button
                @click="switchSource('gitee')"
                class="px-2.5 py-1 transition-colors border-l border-gray-200"
                :class="repoSource === 'gitee' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'"
              >Gitee</button>
            </div>
          </div>
          <div v-if="loadingRepos" class="p-8 text-center text-gray-500">
            {{ t('common.loadingRepos') }}
          </div>
          <div v-else-if="filteredRepos.length === 0" class="p-8 text-center text-gray-500">
            {{ projects.length > 0 ? t('dashboard.allReposAdded') : t('dashboard.noReposToken') }}
          </div>
          <div v-else class="divide-y divide-gray-200 overflow-y-auto">
            <div 
              v-for="repo in filteredRepos" 
              :key="`${repo.source}:${repo.fullName}`"
              class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-900">{{ repo.fullName }}</span>
                  <span v-if="repo.private" class="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{{ t('common.private') }}</span>
                </div>
                <p v-if="repo.description" class="text-sm text-gray-500 truncate mt-0.5">{{ repo.description }}</p>
              </div>
              <button 
                @click="addProject(repo.fullName, repo.source)"
                :disabled="adding === `${repo.source}:${repo.fullName}`"
                class="ml-4 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ adding === `${repo.source}:${repo.fullName}` ? t('common.adding') : t('common.add') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>