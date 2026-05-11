<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTextSelection } from '@vueuse/core'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

// Use markdown composable with copy button support
const { parse: parseMarkdown } = useMarkdown()

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()

// Auth state
const { authChecked, showPasswordInput, password, authError, checkAuth, handleLogin } = useAuth()
const project = ref(null)

// Parse slug: first segment is projectId, rest is filePath
const slug = computed(() => {
  const s = route.params.slug
  return Array.isArray(s) ? s : s ? [s] : []
})

const projectId = computed(() => slug.value[0] || '')
const filePath = computed(() => slug.value.slice(1).join('/'))
const hasFile = computed(() => filePath.value.length > 0)

// Set page title based on project and file path
useHead(() => ({
  title: computed(() => {
    const projectName = project.value?.name || 'ClawDocu'
    const path = filePath.value || ''
    if (path) {
      return `${projectName}/${path}`
    }
    return projectName
  })
}))

// Use composables
const {
  comments,
  showCommentBox,
  selectedText,
  commentText,
  commentBoxTop,
  sortedComments,
  hasChanges,
  loadComments,
  openCommentBox,
  closeCommentBox,
  saveComment,
  deleteComment,
  syncComments
} = useComments()

const {
  flatTree,
  expandedPaths,
  selectedFile,
  loading: treeLoading,
  branches,
  selectedBranch,
  commentCounts,
  loadTree,
  loadCommentCounts,
  incrementCommentCount,
  decrementCommentCount,
  toggleFolder,
  selectFile,
  changeBranch,
  getFileIcon,
  syncBranchFromUrl,
  getCurrentBranch
} = useFileTree()

// Local state
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  item: null as any
})
const fileContent = ref('')
const loading = ref(false)
const markdownMode = ref('render')
const markdownRef = ref(null)
const contentRef = ref(null)
const scrollContainerRef = ref(null)
const sidebarOpen = ref(true)
const showToolbar = ref(false)
const toolbarPosition = ref({ top: 0, left: 0 })
const commentPositionsVersion = ref(0)
const selectedLineNumber = ref(1)
const currentCommentIndex = ref(0)
const mobileTab = ref<'files' | 'comments' | null>(null)

// Find line number from DOM
function findLineNumberFromDOM(): number {
  if (isMarkdown.value && markdownMode.value === 'render' && markdownRef.value) {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      let node: Node | null = range.startContainer
      while (node && node !== markdownRef.value) {
        if (node instanceof Element && node.hasAttribute('data-line')) {
          return parseInt(node.getAttribute('data-line') || '1', 10)
        }
        node = node.parentElement
      }
    }
  }
  return 0
}

const textSelection = useTextSelection()

// Track window width for mobile detection
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
onMounted(() => {
  windowWidth.value = window.innerWidth
  window.addEventListener('resize', () => {
    windowWidth.value = window.innerWidth
  })
})

const isMarkdown = computed(() => {
  const ext = selectedFile.value?.name?.split('.').pop()?.toLowerCase()
  return ext === 'md' || ext === 'markdown'
})

const filePathSegments = computed(() => {
  return selectedFile.value?.path?.split('/').filter(Boolean) || []
})

const fileExtension = computed(() => {
  const ext = selectedFile.value?.name?.split('.').pop()?.toLowerCase()
  return ext || 'text'
})

const getHighlightLanguage = (ext: string): string => {
  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'vue': 'xml',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'kt': 'kotlin',
    'swift': 'swift',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'sh': 'bash',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sql': 'sql',
    'xml': 'xml',
    'toml': 'toml',
  }
  return langMap[ext] || 'plaintext'
}

const highlightedLines = computed(() => {
  if (!fileContent.value) return []
  const lang = getHighlightLanguage(fileExtension.value)
  try {
    const highlighted = hljs.highlight(fileContent.value, { language: lang, ignoreIllegals: true }).value
    return highlighted.split('\n')
  } catch (e) {
    return fileContent.value.split('\n')
  }
})

const lines = computed(() => fileContent.value.split('\n'))

const contentHeight = ref(0)

// Rendered markdown with highlighted comments
const renderedMarkdown = computed(() => {
  if (!fileContent.value) return ''
  
  let html = parseMarkdown(fileContent.value)
  
  // Highlight commented text in rendered markdown
  for (const comment of comments.value) {
    if (comment.selectedText) {
      // Get only the first line of selected text for highlighting
      const firstLine = comment.selectedText.split('\n')[0]
      if (firstLine && firstLine.trim()) {
        // Escape special regex characters
        const escapedText = firstLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // Create a regex to find the text (case-sensitive, first occurrence)
        const regex = new RegExp(`(${escapedText})`, 'g')
        // Wrap with highlight span
        html = html.replace(regex, '<mark class="bg-red-100 text-inherit rounded px-0.5" data-comment-id="' + comment.id + '">$1</mark>')
      }
    }
  }
  
  return html
})

function updateContentHeight() {
  if (contentRef.value) {
    contentHeight.value = contentRef.value.scrollHeight
  }
}

const commentedLines = computed(() => {
  const lineSet = new Set<number>()
  for (const comment of comments.value) {
    if (comment.lineNumber) {
      lineSet.add(comment.lineNumber)
    }
  }
  return lineSet
})

function getPositionByLineNumber(lineNumber: number, commentId?: string): number {
  if (!contentRef.value || !scrollContainerRef.value) return 0
  const containerRect = scrollContainerRef.value.getBoundingClientRect()

  if (isMarkdown.value && markdownMode.value === 'render' && markdownRef.value) {
    // Find element with data-line attribute
    const el = markdownRef.value.querySelector(`[data-line="${lineNumber}"]`)
    if (el) {
      const rect = el.getBoundingClientRect()
      return rect.top - containerRect.top + scrollContainerRef.value.scrollTop
    }
    return 0
  }

  const codeBlock = contentRef.value.querySelector('pre code')
  if (codeBlock) {
    const lineSpans = codeBlock.querySelectorAll('.block')
    if (lineSpans.length >= lineNumber && lineNumber > 0) {
      const lineEl = lineSpans[lineNumber - 1]
      const rect = lineEl.getBoundingClientRect()
      return rect.top - containerRect.top + scrollContainerRef.value.scrollTop
    }
  }
  return (lineNumber - 1) * 24 + 24
}

// Track actual comment box heights after rendering
const commentBoxHeights = ref<Record<string, number>>({})

// Update comment box height after render
function updateCommentBoxHeight(commentId: string, height: number) {
  commentBoxHeights.value[commentId] = height
  // Trigger re-calculation of positions
  commentPositionsVersion.value++
}

// Pre-calculated comment positions to prevent overlap
const commentPositions = computed(() => {
  void commentPositionsVersion.value
  
  const positions: Record<string, number> = {}
  const minCommentHeight = 150 // Minimum height for a comment box (increased)
  const margin = 20 // Margin between comments (increased to 20px)
  
  // Track placed comments and their bottom positions
  const placedComments: { id: string; top: number; bottom: number }[] = []
  
  for (const comment of sortedComments.value) {
    const baseTop = getPositionByLineNumber(comment.lineNumber || 1, comment.id)
    // Use actual height if available, otherwise use minimum
    const height = commentBoxHeights.value[comment.id] || minCommentHeight
    
    // Check collision with all previously placed comments
    let adjustedTop = baseTop
    for (const placed of placedComments) {
      // If this comment's desired position overlaps with a placed comment
      if (adjustedTop < placed.bottom + margin) {
        // Move it down to avoid overlap
        adjustedTop = Math.max(adjustedTop, placed.bottom + margin)
      }
    }
    
    positions[comment.id] = adjustedTop
    placedComments.push({
      id: comment.id,
      top: adjustedTop,
      bottom: adjustedTop + height
    })
  }
  
  return positions
})

const getCommentTop = (comment: any): number => {
  return commentPositions.value[comment.id] || getPositionByLineNumber(comment.lineNumber || 1)
}

// Load project and file
onMounted(async () => {
  await checkAuth()
  if (!showPasswordInput.value) {
    await loadProject()
    await loadTree(projectId.value)
    if (filePath.value) {
      await loadFileFromPath(filePath.value)
    }
  }
})

// Watch for auth completion
watch([authChecked, showPasswordInput], async () => {
  if (authChecked.value && !showPasswordInput.value) {
    await loadProject()
    await loadTree(projectId.value)
    if (filePath.value) {
      await loadFileFromPath(filePath.value)
    }
  }
})

// Watch for route changes
watch(slug, async (newSlug, oldSlug) => {
  const newProjectId = newSlug[0]
  const newFilePath = newSlug.slice(1).join('/')
  const oldProjectId = oldSlug?.[0]
  const oldFilePath = oldSlug?.slice(1).join('/')
  
  // Sync branch from URL query
  syncBranchFromUrl()
  
  if (newProjectId !== oldProjectId) {
    await loadProject()
    await loadTree(projectId.value)
  }
  
  if (newFilePath !== oldFilePath && newFilePath) {
    await loadFileFromPath(newFilePath)
  }
})

// Watch for branch changes and update URL + reload file
watch(selectedBranch, async (newBranch, oldBranch) => {
  console.log('[Branch Watch] Triggered:', { 
    newBranch, 
    oldBranch, 
    selectedFile: selectedFile.value?.path, 
    filePath: filePath.value,
    authChecked: authChecked.value,
    showPasswordInput: showPasswordInput.value,
    condition: newBranch && authChecked.value && !showPasswordInput.value && newBranch !== oldBranch
  })
  
  if (newBranch && authChecked.value && !showPasswordInput.value && newBranch !== oldBranch) {
    console.log('[Branch Watch] Condition passed, updating URL and reloading file')
    // Update URL query parameter
    const query = { ...route.query }
    if (newBranch === 'main' || !newBranch) {
      delete query.branch
    } else {
      query.branch = newBranch
    }
    router.replace({ query })
    
    // Reload current file if a file is selected
    if (selectedFile.value?.path) {
      console.log('[Branch Watch] About to call loadFile for:', selectedFile.value.path)
      await loadFile(selectedFile.value)
      console.log('[Branch Watch] loadFile completed')
    } else if (filePath.value) {
      // If selectedFile not set but we have filePath from URL, reload that
      console.log('[Branch Watch] Reloading from filePath:', filePath.value, 'with branch:', newBranch)
      await loadFileFromPath(filePath.value)
    } else {
      console.log('[Branch Watch] No file to reload')
    }
  }
})

async function loadProject() {
  try {
    project.value = await $fetch(`/api/projects/${projectId.value}`)
  } catch (e) {
    console.error('Failed to load project:', e)
  }
}

async function onLogin() {
  const success = await handleLogin()
  if (success) {
    await loadProject()
    await loadTree(projectId.value)
    if (filePath.value) {
      await loadFileFromPath(filePath.value)
    }
  }
}

async function loadFileFromPath(path: string) {
  const item = {
    name: path.split('/').pop() || '',
    path: path,
    type: 'file' as const,
    depth: 0
  }
  await loadFile(item)
}

async function loadFile(item: { path: string; name: string; type: string }) {
  console.log('[loadFile] Called with:', { path: item.path, type: item.type })
  if (item.type !== 'file') {
    console.log('[loadFile] Early return - not a file')
    return
  }
  
  loading.value = true
  selectFile(item as any)
  
  console.log('[loadFile] Loading file:', item.path, 'with branch:', selectedBranch.value)
  
  try {
    const response = await $fetch(`/api/projects/${projectId.value}/file`, {
      query: { path: item.path, branch: selectedBranch.value }
    })
    console.log('[loadFile] Response received, content length:', response.content?.length)
    fileContent.value = response.content || ''
    await loadComments(projectId.value, item.path)
  } catch (e: any) {
    console.error('Failed to load file:', e)
    // If file not found (404), redirect to project root
    if (e.statusCode === 404 || e.status === 404) {
      console.log('[loadFile] File not found, redirecting to project root')
      const query = selectedBranch.value && selectedBranch.value !== 'main'
        ? { branch: selectedBranch.value }
        : {}
      router.push({ path: `/project/${projectId.value}`, query })
    }
  } finally {
    loading.value = false
    await nextTick()
    updateContentHeight()
  }
}

function handleSelectFile(item: { path: string; name: string; type: string }) {
  if (item.type === 'file') {
    const currentBranch = getCurrentBranch()
    const query = currentBranch && currentBranch !== 'main' 
      ? { branch: currentBranch } 
      : {}
    router.push({ 
      path: `/project/${projectId.value}/${item.path}`,
      query
    })
  } else {
    toggleFolder(item.path)
  }
}

watch(
  () => textSelection.text.value,
  (text) => {
    if (text && text.length >= 2) {
      selectedText.value = text
      const rects = textSelection.rects.value
      if (rects && rects.length > 0) {
        // Use the first rectangle (top line of selection)
        const firstRect = rects[0]
        // Position toolbar at top-left of selected text
        toolbarPosition.value = {
          top: firstRect.top - 45,
          left: firstRect.left  // Left edge of first line text
        }
        if (scrollContainerRef.value) {
          const containerRect = scrollContainerRef.value.getBoundingClientRect()
          commentBoxTop.value = firstRect.top - containerRect.top + scrollContainerRef.value.scrollTop
        }
      }
      const domLine = findLineNumberFromDOM()
      if (domLine > 0) {
        selectedLineNumber.value = domLine
      } else {
        selectedLineNumber.value = findLineNumber(text)
      }
      showToolbar.value = true
    } else {
      showToolbar.value = false
    }
  }
)

function openCommentBoxLocal() {
  showToolbar.value = false
  openCommentBox(selectedText.value, commentBoxTop.value)
}

function closeCommentBoxLocal() {
  closeCommentBox()
}

function copySelectedText() {
  if (selectedText.value) {
    navigator.clipboard.writeText(selectedText.value)
    showToolbar.value = false
  }
}

watch(markdownMode, async () => {
  await nextTick()
  commentPositionsVersion.value++
  updateContentHeight()
})

async function handleSaveComment() {
  if (!commentText.value.trim() || !selectedFile.value?.path) return
  await saveComment(projectId.value, selectedFile.value.path, selectedLineNumber.value)
  // Update comment count locally (no need to fetch from API)
  incrementCommentCount(selectedFile.value.path)
  await nextTick()
  await nextTick()
  await nextTick() // Triple nextTick to ensure markdown highlights are rendered
  commentPositionsVersion.value++
  updateContentHeight()
}

const syncing = ref(false)

async function handleRefresh() {
  if (!selectedFile.value?.path) return
  await loadFile(selectedFile.value)
}

async function handleSync() {
  if (!hasChanges.value || syncing.value) return
  syncing.value = true
  try {
    await syncComments(projectId.value)
    await loadCommentCounts(projectId.value)
  } finally {
    syncing.value = false
  }
}

function findLineNumber(text: string): number {
  if (!fileContent.value || !text) return 1
  let index = fileContent.value.indexOf(text)
  if (index !== -1) {
    return fileContent.value.substring(0, index).split('\n').length
  }
  const trimmedText = text.trim()
  index = fileContent.value.indexOf(trimmedText)
  if (index !== -1) {
    return fileContent.value.substring(0, index).split('\n').length
  }
  const lowerContent = fileContent.value.toLowerCase()
  const lowerText = text.toLowerCase()
  index = lowerContent.indexOf(lowerText)
  if (index !== -1) {
    return fileContent.value.substring(0, index).split('\n').length
  }
  return 1
}

function handleClickComment(comment: any) {
  const idx = sortedComments.value.findIndex(c => c.id === comment.id)
  if (idx >= 0) currentCommentIndex.value = idx
  scrollToCommentLine(comment)
}

async function handleDeleteComment(commentId: string) {
  await deleteComment(projectId.value, commentId)
  // Update comment count locally (no need to fetch from API)
  if (selectedFile.value?.path) {
    decrementCommentCount(selectedFile.value.path)
  }
  await nextTick()
  commentPositionsVersion.value++
  updateContentHeight()
  if (currentCommentIndex.value >= sortedComments.value.length) {
    currentCommentIndex.value = sortedComments.value.length - 1
  }
}

function scrollToCommentLine(comment: any) {
  const top = getPositionByLineNumber(comment.lineNumber || 1)
  if (scrollContainerRef.value) {
    scrollContainerRef.value.scrollTo({ top: Math.max(0, top - 100), behavior: 'smooth' })
  }
}

function navigateComment(direction: 1 | -1) {
  const total = sortedComments.value.length
  if (total === 0) return
  let newIndex = currentCommentIndex.value + direction
  if (newIndex < 0) newIndex = total - 1
  if (newIndex >= total) newIndex = 0
  currentCommentIndex.value = newIndex
  const comment = sortedComments.value[currentCommentIndex.value]
  if (comment) {
    scrollToCommentLine(comment)
  }
}

watch(() => comments.value.length, async () => {
  if (currentCommentIndex.value >= comments.value.length) {
    currentCommentIndex.value = Math.max(0, comments.value.length - 1)
  }
  // Recalculate positions when comments change
  await nextTick()
  await nextTick()
  commentPositionsVersion.value++
})

function showFileMenu(event: MouseEvent, item: any) {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    item
  }
}

function closeContextMenu() {
  contextMenu.value.show = false
  contextMenu.value.item = null
}

async function renameItem() {
  const item = contextMenu.value.item
  if (!item) return
  
  closeContextMenu() // Close menu immediately
  
  const newName = prompt('Enter new name:', item.name)
  if (!newName || newName === item.name) {
    return
  }
  
  loading.value = true // Show loading
  
  try {
    const oldPath = item.path
    const pathParts = oldPath.split('/')
    pathParts[pathParts.length - 1] = newName
    const newPath = pathParts.join('/')
    
    const res = await $fetch(`/api/projects/${projectId.value}/file.rename`, {
      method: 'POST',
      body: {
        oldPath,
        newPath,
        branch: selectedBranch.value
      }
    })
    
    if (res.success) {
      // Refresh the file tree
      await loadTree(projectId.value, selectedBranch.value)
    }
  } catch (error: any) {
    console.error('Rename failed:', error)
    alert(error.data?.message || 'Failed to rename')
  } finally {
    loading.value = false // Hide loading
  }
}

async function deleteItem() {
  const item = contextMenu.value.item
  if (!item) return
  
  closeContextMenu() // Close menu immediately
  
  const confirmed = confirm(`Are you sure you want to delete "${item.name}"?`)
  if (!confirmed) {
    return
  }
  
  loading.value = true // Show loading
  
  try {
    const res = await $fetch(`/api/projects/${projectId.value}/file`, {
      method: 'DELETE',
      query: {
        path: item.path,
        branch: selectedBranch.value
      }
    })
    
    if (res.success) {
      // Refresh the file tree
      await loadTree(projectId.value, selectedBranch.value)
      // Navigate away if we deleted the current file
      if (selectedFile.value?.path === item.path) {
        const query = selectedBranch.value && selectedBranch.value !== 'main'
          ? { branch: selectedBranch.value }
          : {}
        router.push({ 
          path: `/project/${projectId.value}`,
          query
        })
      }
    }
  } catch (error: any) {
    console.error('Delete failed:', error)
    alert(error.data?.message || 'Failed to delete')
  } finally {
    loading.value = false // Hide loading
  }
}

// Close context menu on click outside
onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu)
})
</script>

<template>
  <!-- Loading State -->
  <div v-if="!authChecked" class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-gray-500">Loading...</div>
  </div>
  
  <!-- Password Input Modal -->
  <div v-else-if="showPasswordInput" class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full mx-4">
      <div class="bg-white rounded-lg shadow-md p-8">
        <h1 class="text-2xl font-bold text-gray-900 mb-2">ClawDocu</h1>
        <p class="text-gray-600 mb-6">Enter password to view this file</p>
        
        <form @submit.prevent="onLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              v-model="password"
              type="password"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Enter admin password"
              autofocus
            />
          </div>
          
          <p v-if="authError" class="text-sm text-red-600">{{ authError }}</p>
          
          <button 
            type="submit"
            class="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  </div>
  
  <!-- Main Content (when authenticated) -->
  <div v-else class="flex-1 flex min-h-0 relative">
    <!-- File Tree Sidebar (desktop only) -->
    <div class="hidden md:block">
      <FileTree 
        :projectId="projectId"
        v-model:sidebarOpen="sidebarOpen"
        @selectFile="handleSelectFile"
        @showFileMenu="showFileMenu"
      />
    </div>

    <!-- Main Content Area with Comments -->
    <div class="flex-1 flex min-w-0 flex-col pb-14 md:pb-0">
      <!-- File Header -->
      <div class="flex shrink-0 border-b border-gray-200 bg-white overflow-y-auto" style="scrollbar-gutter: stable">
        <div class="flex-1 min-w-0 flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-2 text-sm overflow-x-auto">
            <span class="text-gray-400 whitespace-nowrap">{{ project?.fullName }}</span>
            <span class="text-gray-300">/</span>
            <template v-if="hasFile">
              <span 
                v-for="(segment, i) in filePathSegments" 
                :key="i" 
                class="flex items-center gap-2"
              >
                <span class="text-gray-700 whitespace-nowrap">{{ segment }}</span>
                <span v-if="i < filePathSegments.length - 1" class="text-gray-300">/</span>
              </span>
            </template>
            <span v-else class="text-gray-500">Select a file to view</span>
          </div>
          
          <!-- Mobile View/Raw tabs -->
          <div v-if="hasFile && isMarkdown" class="flex md:hidden items-center gap-1">
            <button 
              @click="markdownMode = 'render'"
              class="px-2 py-1 text-xs rounded-lg transition-colors"
              :class="markdownMode === 'render' ? 'bg-red-100 text-red-600' : 'text-gray-500 hover:bg-gray-100'"
            >
              View
            </button>
            <button 
              @click="markdownMode = 'source'"
              class="px-2 py-1 text-xs rounded-lg transition-colors"
              :class="markdownMode === 'source' ? 'bg-red-100 text-red-600' : 'text-gray-500 hover:bg-gray-100'"
            >
              Raw
            </button>
          </div>
          
          <div class="hidden md:flex items-center gap-3">
            <button 
              v-if="hasFile"
              @click="handleRefresh"
              class="px-3 py-1 text-sm rounded-lg transition-colors flex items-center gap-1 bg-gray-100 text-gray-700 hover:bg-gray-200"
              title="Refresh file from GitHub"
            >
              <Icon name="i-lucide-refresh-cw" class="w-4 h-4" />
              Refresh
            </button>
            <button 
              v-if="hasFile"
              @click="handleSync"
              class="px-3 py-1 text-sm rounded-lg transition-colors flex items-center gap-1"
              :class="[
                syncing ? 'bg-red-400 text-white cursor-wait' :
                hasChanges ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-100 text-gray-400 cursor-default'
              ]"
              :disabled="!hasChanges || syncing"
              title="Sync comments to GitHub"
            >
              <Icon :name="syncing ? 'i-lucide-loader-circle' : 'i-lucide-upload-cloud'" class="w-4 h-4" :class="syncing ? 'animate-spin' : ''" />
              {{ syncing ? 'Syncing...' : 'Sync' }}
            </button>

            <div v-if="hasFile && isMarkdown" class="flex items-center gap-2">
              <button 
                @click="markdownMode = 'render'"
                class="px-3 py-1 text-sm rounded-lg transition-colors"
                :class="markdownMode === 'render' ? 'bg-red-100 text-red-600' : 'text-gray-500 hover:bg-gray-100'"
              >
                View
              </button>
              <button 
                @click="markdownMode = 'source'"
                class="px-3 py-1 text-sm rounded-lg transition-colors"
                :class="markdownMode === 'source' ? 'bg-red-100 text-red-600' : 'text-gray-500 hover:bg-gray-100'"
              >
                Raw
              </button>
            </div>

            <a 
              v-if="hasFile && project?.fullName"
              :href="`https://github.com/${project.fullName}/blob/main/${filePath}`" 
              target="_blank"
              class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Icon name="i-lucide-github" class="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>

        <div class="hidden md:block">
          <CommentsHeader
            v-if="hasFile"
            :comments="comments"
            :sortedComments="sortedComments"
            :currentCommentIndex="currentCommentIndex"
            @navigate="navigateComment"
          />
        </div>
      </div>

      <!-- Scrollable Content + Comments Container -->
      <div ref="scrollContainerRef" class="flex-1 overflow-auto bg-white" style="scrollbar-gutter: stable">
        <div class="flex min-h-full">
          <!-- File Content -->
          <div ref="contentRef" class="flex-1 min-w-0 p-4 md:p-6 bg-white">
            <!-- Loading -->
            <div v-if="loading" class="text-gray-400 text-center py-8">Loading...</div>
            
            <!-- Empty State (no file selected) -->
            <div v-else-if="!hasFile" class="text-gray-400 text-center py-16">
              <Icon name="i-lucide-file-text" class="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Select a file from the tree to view its contents</p>
            </div>
            
            <!-- Markdown Rendered -->
            <div 
              v-else-if="isMarkdown && markdownMode === 'render'" 
              ref="markdownRef"
              class="prose prose-sm max-w-none select-text"
              v-html="renderedMarkdown"
            />
            
            <!-- Code View -->
            <pre v-else-if="hasFile" class="text-sm leading-6 hljs overflow-x-auto"><code class="language-typescript"><template v-for="(line, i) in highlightedLines" :key="i"><span class="block" :class="commentedLines.has(i + 1) ? 'bg-red-50 border-l-2 border-red-400' : ''"><span class="text-gray-400 select-none pr-4 inline-block w-12 text-right">{{ i + 1 }}</span><span v-html="line || '&nbsp;'"></span></span></template></code></pre>
          </div>

          <!-- Comments Column (desktop) -->
          <div class="hidden md:block">
            <CommentsSidebar
              v-if="hasFile"
              v-model:commentText="commentText"
              :comments="comments"
              :sortedComments="sortedComments"
              :currentCommentIndex="currentCommentIndex"
              :showCommentBox="showCommentBox"
              :selectedText="selectedText"
              :commentBoxTop="commentBoxTop"
              :contentHeight="contentHeight"
              :linesCount="lines.length"
              :getCommentTop="getCommentTop"
              @save="handleSaveComment"
              @cancel="closeCommentBoxLocal"
              @delete="handleDeleteComment"
              @clickComment="handleClickComment"
              @heightUpdate="updateCommentBoxHeight"
            />
            
            <!-- Empty Comments Sidebar (no file) -->
            <aside v-else class="w-80 shrink-0 border-l border-gray-200 bg-white">
              <div class="p-4">
                <h3 class="text-xs font-semibold text-gray-500 uppercase mb-3">Comments</h3>
                <div class="text-gray-400 text-sm text-center py-8">
                  Select a file to view comments.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile Bottom Tabs -->
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-40">
      <button 
        @click="mobileTab = mobileTab === 'files' ? null : 'files'"
        class="flex-1 py-3 flex items-center justify-center gap-2 text-sm"
        :class="mobileTab === 'files' ? 'text-red-600 bg-red-50' : 'text-gray-600'"
      >
        <Icon name="i-lucide-folder" class="w-5 h-5" />
        Files
      </button>
      <button 
        @click="mobileTab = mobileTab === 'comments' ? null : 'comments'"
        class="flex-1 py-3 flex items-center justify-center gap-2 text-sm"
        :class="mobileTab === 'comments' ? 'text-red-600 bg-red-50' : 'text-gray-600'"
      >
        <Icon name="i-lucide-message-square" class="w-5 h-5" />
        Comments
        <span 
          v-if="comments.length > 0" 
          class="bg-red-500 text-white text-xs rounded-full px-1.5 min-w-[20px] h-5 flex items-center justify-center"
        >
          {{ comments.length }}
        </span>
      </button>
      <button 
        @click="handleRefresh"
        class="flex-1 py-3 flex items-center justify-center gap-2 text-sm text-gray-600"
      >
        <Icon name="i-lucide-refresh-cw" class="w-5 h-5" />
        Refresh
      </button>
      <button 
        @click="handleSync"
        :disabled="syncing || !hasChanges"
        class="flex-1 py-3 flex items-center justify-center gap-2 text-sm"
        :class="syncing ? 'text-gray-400' : hasChanges ? 'text-red-600 bg-red-50' : 'text-gray-400'"
      >
        <Icon :name="syncing ? 'i-lucide-loader-circle' : 'i-lucide-upload-cloud'" class="w-5 h-5" :class="syncing ? 'animate-spin' : ''" />
        {{ syncing ? 'Syncing' : 'Sync' }}
      </button>
    </div>

    <!-- Mobile Files Panel -->
    <Teleport to="body">
      <div 
        v-if="mobileTab === 'files'"
        class="fixed inset-0 z-50 md:hidden"
      >
        <div class="absolute inset-0 bg-black/50" @click="mobileTab = null" />
        <div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] overflow-hidden flex flex-col">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-semibold">Files</h3>
            <button @click="mobileTab = null" class="p-1 text-gray-400 hover:text-gray-600">
              <Icon name="i-lucide-x" class="w-5 h-5" />
            </button>
          </div>
          <div class="overflow-y-auto flex-1">
            <MobileFileList 
              :projectId="projectId"
              @selectFile="(item) => { handleSelectFile(item); mobileTab = null }"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Mobile Comments Panel -->
    <Teleport to="body">
      <div 
        v-if="mobileTab === 'comments'"
        class="fixed inset-0 z-50 md:hidden"
      >
        <div class="absolute inset-0 bg-black/50" @click="mobileTab = null" />
        <div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] overflow-hidden flex flex-col">
          <div class="flex items-center justify-between p-4 border-b">
            <h3 class="font-semibold">Comments ({{ comments.length }})</h3>
            <button @click="mobileTab = null" class="p-1 text-gray-400 hover:text-gray-600">
              <Icon name="i-lucide-x" class="w-5 h-5" />
            </button>
          </div>
          <div class="overflow-y-auto flex-1 p-4">
            <div v-if="sortedComments.length > 0" class="space-y-3">
              <div 
                v-for="(comment, idx) in sortedComments" 
                :key="comment.id"
                class="p-3 bg-gray-50 rounded-lg border"
                :class="idx === currentCommentIndex ? 'border-red-300 bg-red-50' : 'border-gray-200'"
                @click="handleClickComment(comment); mobileTab = null"
              >
                <div class="text-xs text-gray-400 mb-1">Line {{ comment.lineNumber }}</div>
                <div v-if="comment.selectedText" class="text-xs text-gray-500 mb-2 p-2 bg-white rounded italic">"{{ comment.selectedText }}"</div>
                <div class="text-sm text-gray-700">{{ comment.text }}</div>
              </div>
            </div>
            
            <div v-else class="text-gray-400 text-sm text-center py-8">
              Select text in the file to add a comment.
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Mobile Comment Input Popup -->
    <Teleport to="body">
      <div 
        v-if="showCommentBox && windowWidth < 768"
        class="fixed inset-0 z-50 md:hidden"
      >
        <div class="absolute inset-0 bg-black/50" @click="closeCommentBoxLocal" />
        <div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold">Add Comment</h3>
            <button @click="closeCommentBoxLocal" class="p-1 text-gray-400 hover:text-gray-600">
              <Icon name="i-lucide-x" class="w-5 h-5" />
            </button>
          </div>
          <div class="mb-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
            {{ selectedText }}
          </div>
          <textarea
            v-model="commentText"
            placeholder="Write your comment..."
            class="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            rows="3"
          />
          <div class="flex gap-2 mt-3">
            <button 
              @click="closeCommentBoxLocal"
              class="flex-1 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button 
              @click="handleSaveComment"
              class="flex-1 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700"
              :disabled="!commentText.trim()"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Text Selection Toolbar -->
    <Teleport to="body">
      <div 
        v-if="showToolbar"
        class="fixed bg-white border border-gray-200 rounded-lg shadow-lg px-2 py-1 flex items-center gap-2 z-50"
        :style="{ top: toolbarPosition.top + 'px', left: toolbarPosition.left + 'px' }"
      >
        <button 
          @click="copySelectedText"
          class="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
        >
          <Icon name="i-lucide-copy" class="w-4 h-4" />
          <span>Copy</span>
        </button>
        <button 
          @click="openCommentBoxLocal"
          class="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
        >
          <Icon name="i-lucide-message-square-plus" class="w-4 h-4" />
          <span>Comment</span>
        </button>
      </div>
    </Teleport>
    
    <!-- Context Menu -->
    <Teleport to="body">
      <div 
        v-if="contextMenu.show"
        class="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[150px]"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
      >
        <button
          @click="renameItem"
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <Icon name="i-lucide-pencil" class="w-4 h-4" />
          Rename
        </button>
        <button
          @click="deleteItem"
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <Icon name="i-lucide-trash-2" class="w-4 h-4" />
          Delete
        </button>
      </div>
    </Teleport>
  </div>
</template>