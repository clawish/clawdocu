<script setup lang="ts">
const { checkAuth } = useAuth()

onMounted(async () => {
  await checkAuth()
})
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <AppHeader />
    <div class="flex-1 min-h-0">
      <slot />
    </div>
  </div>
</template>
