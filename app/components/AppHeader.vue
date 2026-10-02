<script setup lang="ts">
const props = defineProps<{
  project?: { name: string; fullName: string } | null
  showBack?: boolean
}>()

const { user, logout } = useAuth()
const config = useRuntimeConfig()
const version = config.public.version

const { t, locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
// Close the dropdown when a locale is chosen — native <details> otherwise
// stays open after navigation (same fix as MFT's theme menu).
const langMenu = ref<HTMLDetailsElement | null>(null)
const currentLocaleName = computed(
  () => locales.value.find((l: any) => l.code === locale.value)?.name || locale.value
)
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
            {{ t('nav.dashboard') }}
          </NuxtLink>
          <a 
            href="https://clawdocu.com/docs" 
            target="_blank"
            class="text-sm text-gray-600 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            {{ t('common.docs') }}
            <Icon name="i-lucide-external-link" class="w-3 h-3" />
          </a>
        </nav>
      </div>
      
      <div class="flex items-center gap-3">
        <details ref="langMenu" class="relative">
          <summary class="text-sm text-gray-500 hover:text-red-600 transition-colors cursor-pointer list-none flex items-center gap-1">
            <Icon name="i-lucide-languages" class="w-4 h-4" />
            {{ currentLocaleName }}
          </summary>
          <ul class="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px] z-50">
            <li v-for="l in locales" :key="l.code">
              <NuxtLink
                :to="switchLocalePath(l.code)"
                @click="langMenu?.removeAttribute('open')"
                class="block px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                :class="{ 'font-semibold text-red-600': l.code === locale }"
              >
                {{ l.name }}
              </NuxtLink>
            </li>
          </ul>
        </details>
        <a
          v-if="project?.fullName"
          :href="`https://github.com/${project.fullName}`"
          target="_blank"
          class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <Icon name="i-lucide-github" class="w-4 h-4" />
          {{ t('project.viewOnGithub') }}
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
          {{ t('common.logout') }}
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
