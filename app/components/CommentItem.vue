<script setup lang="ts">
import type { Comment, Followup } from '~/composables/useComments'

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
  edit: [id: string, text: string]
  addFollowup: [commentId: string, body: string]
}>()

const commentRef = ref<HTMLElement | null>(null)
const isEditing = ref(false)
const editText = ref('')
const showReplyInput = ref(false)
const replyText = ref('')

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

function startEdit() {
  editText.value = props.comment.text
  isEditing.value = true
}

function saveEdit() {
  if (!editText.value.trim()) return
  emit('edit', props.comment.id, editText.value.trim())
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
  editText.value = ''
}

function toggleReply() {
  showReplyInput.value = !showReplyInput.value
  if (showReplyInput.value) {
    replyText.value = ''
    nextTick(() => {
      const input = commentRef.value?.querySelector('.reply-textarea') as HTMLTextAreaElement
      input?.focus()
    })
  }
}

function submitReply() {
  if (!replyText.value.trim()) return
  emit('addFollowup', props.comment.id, replyText.value.trim())
  replyText.value = ''
  showReplyInput.value = false
}

function cancelReply() {
  showReplyInput.value = false
  replyText.value = ''
}

const authorBadgeColor: Record<string, string> = {
  agent: 'bg-blue-100 text-blue-600',
  user: 'bg-gray-100 text-gray-600',
}

function getAuthorBadge(author: string) {
  return authorBadgeColor[author] || 'bg-gray-100 text-gray-600'
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
    @click="!isEditing && !showReplyInput && emit('click', comment)"
  >
    <div class="text-xs text-gray-500 mb-1 flex items-center gap-2">
      <span class="bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
        Line {{ comment.lineNumber || 1 }}
      </span>
      <span v-if="orphaned" class="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
        ⚠ Deleted
      </span>
      <span>{{ formatDate(comment.createdAt) }}</span>
    </div>
    <div class="text-xs text-gray-500 mb-2 p-2 bg-white rounded italic">
      "{{ comment.selectedText }}"
    </div>

    <!-- Edit mode -->
    <div v-if="isEditing" class="space-y-2">
      <textarea
        v-model="editText"
        rows="3"
        class="w-full px-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-500 resize-y"
        @click.stop
      />
      <div class="flex justify-end gap-2">
        <button
          @click.stop="cancelEdit"
          class="text-xs px-2.5 py-1 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          @click.stop="saveEdit"
          class="text-xs px-2.5 py-1 text-white bg-red-500 hover:bg-red-600 rounded-lg"
        >
          Save
        </button>
      </div>
    </div>

    <!-- View mode -->
    <p v-else class="text-sm text-gray-900">{{ comment.text }}</p>

    <!-- Followups thread -->
    <div v-if="comment.followups && comment.followups.length > 0" class="mt-2 ml-3 border-l-2 border-gray-200 pl-3 space-y-2">
      <div 
        v-for="followup in comment.followups" 
        :key="followup.id"
        class="relative"
      >
        <div class="flex items-center gap-1.5 mb-1">
          <span class="text-xs px-1.5 py-0.5 rounded font-medium" :class="getAuthorBadge(followup.author)">
            {{ followup.author }}
          </span>
          <span class="text-xs text-gray-400">{{ formatDate(followup.createdAt) }}</span>
        </div>
        <p class="text-sm text-gray-700">{{ followup.body }}</p>
      </div>
    </div>

    <!-- Reply input -->
    <div v-if="showReplyInput" class="mt-2 ml-3 border-l-2 border-red-200 pl-3" @click.stop>
      <textarea
        v-model="replyText"
        rows="2"
        class="reply-textarea w-full px-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-500 resize-y"
        placeholder="Write a reply..."
        @keydown.ctrl.enter="submitReply"
        @keydown.meta.enter="submitReply"
      />
      <div class="flex justify-end gap-2 mt-1">
        <button
          @click.stop="cancelReply"
          class="text-xs px-2.5 py-1 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          @click.stop="submitReply"
          class="text-xs px-2.5 py-1 text-white bg-red-500 hover:bg-red-600 rounded-lg"
          :disabled="!replyText.trim()"
        >
          Reply
        </button>
      </div>
    </div>

    <!-- Action buttons -->
    <div v-if="!isEditing && !showReplyInput" class="flex justify-end mt-2 gap-1">
      <button 
        @click.stop="toggleReply" 
        class="text-gray-400 hover:text-red-600"
        title="Reply to comment"
      >
        <Icon name="i-lucide-message-circle" class="w-4 h-4" />
      </button>
      <button 
        @click.stop="startEdit" 
        class="text-gray-400 hover:text-red-600"
        title="Edit comment"
      >
        <Icon name="i-lucide-pencil" class="w-4 h-4" />
      </button>
      <button 
        @click.stop="emit('delete', comment.id)" 
        class="text-gray-400 hover:text-red-600"
        title="Delete comment"
      >
        <Icon name="i-lucide-trash" class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
