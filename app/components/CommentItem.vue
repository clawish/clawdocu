<script setup lang="ts">
import type { Comment } from '~/composables/useComments'

defineProps<{
  comment: Comment
  active: boolean
  top: number
}>()

const emit = defineEmits<{
  delete: [id: string]
  click: [comment: Comment]
}>()

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
    class="absolute left-4 right-4 bg-white rounded-lg p-3 border-l-2 shadow-sm transition-all duration-200 cursor-pointer"
    :class="active ? 'border-red-600 ring-2 ring-red-300 shadow-md' : 'border-red-500'"
    :style="{ top: top + 'px' }"
    @click="emit('click', comment)"
  >
    <div class="text-xs text-gray-500 mb-1 flex items-center gap-2">
      <span class="bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
        Line {{ comment.lineNumber || 1 }}
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
