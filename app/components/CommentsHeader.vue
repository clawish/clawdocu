<script setup lang="ts">
import type { Comment } from '~/composables/useComments'

defineProps<{
  comments: Comment[]
  sortedComments: Comment[]
  currentCommentIndex: number
}>()

const emit = defineEmits<{
  'navigate': [direction: 1 | -1]
}>()
</script>

<template>
  <div class="w-80 shrink-0 grow-0 overflow-hidden border-l border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
    <h3 class="text-xs font-semibold text-gray-500 uppercase">
      Comments <span v-if="comments.length" class="text-gray-400">({{ comments.length }})</span>
    </h3>
    <div class="flex items-center gap-1">
      <button 
        @click="emit('navigate', -1)"
        class="p-1 rounded hover:bg-gray-100 transition-colors"
        :class="sortedComments.length === 0 || currentCommentIndex <= 0 ? 'opacity-30 cursor-default' : 'cursor-pointer'"
        title="Previous comment"
      >
        <Icon name="i-lucide-chevron-up" class="w-4 h-4 text-gray-500" />
      </button>
      <span v-if="sortedComments.length > 0" class="text-xs text-gray-500 min-w-[24px] text-center">
        {{ currentCommentIndex + 1 }}/{{ sortedComments.length }}
      </span>
      <button 
        @click="emit('navigate', 1)"
        class="p-1 rounded hover:bg-gray-100 transition-colors"
        :class="sortedComments.length === 0 || currentCommentIndex >= sortedComments.length - 1 ? 'opacity-30 cursor-default' : 'cursor-pointer'"
        title="Next comment"
      >
        <Icon name="i-lucide-chevron-down" class="w-4 h-4 text-gray-500" />
      </button>
    </div>
  </div>
</template>
