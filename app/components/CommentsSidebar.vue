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
  'heightUpdate': [id: string, height: number]
}>()
</script>

<template>
  <div class="w-80 shrink-0 grow-0 overflow-hidden border-l border-gray-200 bg-gray-50 overflow-y-auto">
    <!-- Comments container - uses flex with gap for auto spacing -->
    <div class="p-4 space-y-4">
      <!-- Comment Input Box -->
      <CommentInput 
        v-if="showCommentBox"
        v-model:commentText="commentText"
        :selectedText="selectedText"
        :top="0"
        @save="emit('save')"
        @cancel="emit('cancel')"
      />
      
      <!-- Comments stacked with natural spacing -->
      <CommentItem
        v-for="(comment, idx) in sortedComments" 
        :key="comment.id"
        :comment="comment"
        :active="idx === currentCommentIndex"
        :top="0"
        @delete="emit('delete', $event)"
        @click="emit('clickComment', comment)"
      />
      
      <!-- Empty state -->
      <div v-if="comments.length === 0 && !showCommentBox" class="text-gray-400 text-sm text-center py-8">
        Select text to add a comment.
      </div>
    </div>
  </div>
</template>
