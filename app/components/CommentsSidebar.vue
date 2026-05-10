<script setup lang="ts">
import type { Comment } from '~/composables/useComments'

defineProps<{
  comments: Comment[]
  sortedComments: Comment[]
  currentCommentIndex: number
  showCommentBox: boolean
  selectedText: string
  commentBoxTop: number
  contentHeight: number
  linesCount: number
  getCommentTop: (comment: Comment) => number
}>()

const commentText = defineModel<string>('commentText', { default: '' })

const emit = defineEmits<{
  'save': []
  'cancel': []
  'delete': [id: string]
  'clickComment': [comment: Comment]
}>()
</script>

<template>
  <div class="w-80 shrink-0 grow-0 overflow-hidden border-l border-gray-200 bg-gray-50">
    <!-- Comments positioned by line number -->
    <div class="relative z-0" :style="{ minHeight: contentHeight ? contentHeight + 'px' : (linesCount * 24 + 100) + 'px' }">
      <!-- Comment Input Box -->
      <CommentInput 
        v-if="showCommentBox"
        v-model:commentText="commentText"
        :selectedText="selectedText"
        :top="commentBoxTop"
        @save="emit('save')"
        @cancel="emit('cancel')"
      />
      
      <!-- Comments at their line positions -->
      <CommentItem
        v-for="(comment, idx) in sortedComments" 
        :key="comment.id"
        :comment="comment"
        :active="idx === currentCommentIndex"
        :top="getCommentTop(comment)"
        @delete="emit('delete', $event)"
        @click="emit('clickComment', comment)"
      />
    </div>
    
    <!-- Empty state -->
    <div v-if="comments.length === 0 && !showCommentBox" class="p-4">
      <div class="text-gray-400 text-sm text-center py-8">
        Select text to add a comment.
      </div>
    </div>
  </div>
</template>
