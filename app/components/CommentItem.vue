<script setup lang="ts">
import type { Comment } from '~/composables/useComments'

const props = defineProps<{
  comment: Comment
  active: boolean
  top: number
  orphaned?: boolean
}>()

const emit = defineEmits<{
  delete: [id: string]
  click: [comment: Comment]
  heightUpdate: [id: string, height: number]
}>()

const commentRef = ref<HTMLElement | null>(null)

// Use VueUse's useElementSize for reactive height tracking
const { height } = useElementSize(commentRef)

// Watch height changes and emit updates
watch(height, (newHeight) => {
  if (newHeight > 0) {
    emit('heightUpdate', props.comment.id, newHeight)
  }
})

// Also emit on mount
onMounted(() => {
  if (commentRef.value) {
    emit('heightUpdate', props.comment.id, commentRef.value.offsetHeight)
  }
})

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div 
    ref="commentRef"
    class="absolute left-4 right-4 bg-white rounded-lg p-3 border-l-2 shadow-sm transition-all duration-200 cursor-pointer"
    :class="[
      active ? 'border-red-600 ring-2 ring-red-300 shadow-md' : 'border-red-500',
      orphaned ? 'opacity-60' : ''
    ]"
    :style="{ top: top + 'px' }"
    @click="emit('click', comment)"
  >
    <div class="text-xs text-gray-500 mb-1 flex items-center gap-2">
      <span class="bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
        Line {{ comment.lineNumber || 1 }}
      </span>
      <span v-if="orphaned" class="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">\        ⚠ Deleted
      </span>
      <span>{{ formatDate(comment.createdAt) }}</span>
    </div>
    <div class="text-xs text-gray-500 mb-2 p-2 bg-white rounded italic">
      "{{ comment.selectedText }}"
    </div>
    <p class="text-sm text-gray-900">{{ comment.text }}</p>
    <div class="flex justify-end mt-2">
      <button 
        @click.stop="emit('delete', comment.id)" 
        class="text-gray-400 hover:text-red-600"
      >
        <Icon name="i-lucide-trash" class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
