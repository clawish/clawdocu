// Comment state management composable
import type { Ref } from 'vue'

export interface Comment {
  id: string
  path: string
  selectedText: string
  text: string
  lineNumber: number
  createdAt: string
}

// Singleton state
const comments = ref<Comment[]>([])
const allComments = ref<Record<string, Comment[]>>({})
const originalAllComments = ref<Record<string, Comment[]>>({})
const showCommentBox = ref(false)
const selectedText = ref('')
const commentText = ref('')
const commentBoxTop = ref(0)
const currentFilePath = ref<string | null>(null)

export const useComments = () => {
  // Load comments for a file
  const loadComments = async (projectId: string, filePath: string) => {
    currentFilePath.value = filePath
    try {
      const response = await $fetch(`/api/projects/${projectId}/comments`, {
        query: { path: filePath }
      })
      comments.value = response.comments || []
      allComments.value[filePath] = [...comments.value]
      // Keep original in sync — loaded data reflects what's on GitHub
      originalAllComments.value[filePath] = [...comments.value]
    } catch (e) {
      console.error('Failed to load comments:', e)
      comments.value = []
    }
  }

  // Load all comments from API
  const loadAllComments = async (projectId: string) => {
    try {
      const response = await $fetch(`/api/projects/${projectId}/comments`)
      allComments.value = response.comments || {}
      originalAllComments.value = JSON.parse(JSON.stringify(allComments.value))
    } catch (e) {
      console.error('Failed to load all comments:', e)
    }
  }

  // Open comment box at position
  const openCommentBox = (text: string, top: number) => {
    selectedText.value = text
    commentBoxTop.value = top
    commentText.value = ''
    showCommentBox.value = true
  }

  // Close comment box
  const closeCommentBox = (resetPosition = true) => {
    showCommentBox.value = false
    selectedText.value = ''
    commentText.value = ''
    if (resetPosition) {
      commentBoxTop.value = 0
    }
  }

  // Save comment (local only, sync manually)
  const saveComment = async (projectId: string, filePath?: string, lineNumber?: number) => {
    if (!commentText.value.trim()) return
    
    const path = filePath || currentFilePath.value
    if (!path) return

    const comment: Comment = {
      id: Date.now().toString(),
      path: path,
      selectedText: selectedText.value,
      text: commentText.value,
      lineNumber: lineNumber || 1,
      createdAt: new Date().toISOString()
    }

    comments.value.push(comment)
    allComments.value[path] = [...(allComments.value[path] || []), comment]

    closeCommentBox()
    // No auto-sync - user clicks Sync button manually
  }

  // Delete comment (local only, sync manually)
  const deleteComment = async (projectId: string, commentId: string) => {
    comments.value = comments.value.filter(c => c.id !== commentId)
    if (currentFilePath.value) {
      // Keep as empty array so sync knows to delete the file
      allComments.value[currentFilePath.value] = [...comments.value]
    }
    // No auto-sync - user clicks Sync button manually
    
    // Return current file path so caller can refresh counts
    return currentFilePath.value
  }

  // Sync comments to GitHub
  const syncComments = async (projectId: string) => {
    try {
      await $fetch(`/api/projects/${projectId}/comments/sync`, {
        method: 'POST',
        body: {
          comments: allComments.value
        }
      })
      originalAllComments.value = JSON.parse(JSON.stringify(allComments.value))
    } catch (e) {
      console.error('Failed to sync comments:', e)
    }
  }

  // Set comments for current file (called when selecting a file)
  const setCurrentFileComments = (filePath: string) => {
    currentFilePath.value = filePath
    comments.value = allComments.value[filePath] || []
  }

  // Check if there are unsaved changes
  const hasChanges = computed(() => {
    return JSON.stringify(allComments.value) !== JSON.stringify(originalAllComments.value)
  })

  // Sorted comments by line number
  const sortedComments = computed(() => {
    return [...comments.value].sort((a, b) => (a.lineNumber || 1) - (b.lineNumber || 1))
  })

  return {
    // State
    comments: readonly(comments),
    allComments: readonly(allComments),
    showCommentBox: readonly(showCommentBox),
    selectedText,
    commentText,
    commentBoxTop,
    sortedComments,
    hasChanges,

    // Methods
    loadComments,
    loadAllComments,
    openCommentBox,
    closeCommentBox,
    saveComment,
    deleteComment,
    syncComments,
    setCurrentFileComments,
  }
}
