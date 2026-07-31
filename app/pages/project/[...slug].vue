<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTextSelection } from '@vueuse/core'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

// Use markdown composable with copy button support
const { parse: parseMarkdown } = useMarkdown()

definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const route = useRoute()
const router = useRouter()

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
  linePositions,
  sortedLineNumbers,
  updateCount,
  initialize: initializeLinePositions,
  scanLineElements,
  getLinePosition,
  getNearestLine,
  getTotalLines,
  getAverageLineHeight,
} = useLinePositions()

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
  editComment,
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
  expandToPath,
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
const markdownMode = ref('render')
const htmlMode = ref('render')
const markdownRef = ref(null)
const htmlPreviewRef = ref(null)
const contentRef = ref(null)
const scrollContainerRef = ref(null)
const sidebarOpen = ref(true)
const showToolbar = ref(false)
const toolbarPosition = ref({ top: 0, left: 0 })
const commentPositionsVersion = ref(0)
const selectedLineNumber = ref(1)
const currentCommentIndex = ref(0)
const mobileTab = ref<'files' | 'comments' | null>(null)
const breadcrumbBar = ref(null) // Ref for breadcrumb bar to check scrollbar-gutter

// Find line number from DOM
function findLineNumberFromDOM(): number {
  if (isMarkdown.value && markdownMode.value === 'render' && markdownRef.value) {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      let node: Node | null = range.startContainer
      while (node && node !== markdownRef.value) {
        if (node instanceof Element && node.hasAttribute('data-source-line')) {
          // Plugin uses 0-indexed, convert to 1-indexed
          return parseInt(node.getAttribute('data-source-line') || '0', 10) + 1
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
  
  // Check scrollbar-gutter on breadcrumb bar
  if (breadcrumbBar.value) {
    const styles = window.getComputedStyle(breadcrumbBar.value)
  }
})

const isMarkdown = computed(() => {
  const ext = selectedFile.value?.name?.split('.').pop()?.toLowerCase()
  return ext === 'md' || ext === 'markdown'
})

const isHtml = computed(() => {
  const ext = selectedFile.value?.name?.split('.').pop()?.toLowerCase()
  return ext === 'html' || ext === 'htm'
})

const isImage = computed(() => {
  const ext = selectedFile.value?.name?.split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext || '')
})

const imageUrl = computed(() => {
  if (!isImage.value || !selectedFile.value?.path) return ''
  const branch = selectedBranch.value || 'main'
  return `/api/projects/${projectId.value}/raw?path=${encodeURIComponent(selectedFile.value.path)}&branch=${branch}`
})

const filePathSegments = computed(() => {
  return selectedFile.value?.path?.split('/').filter(Boolean) || []
})

const fileExtension = computed(() => {
  const ext = selectedFile.value?.name?.split('.').pop()?.toLowerCase()
  return ext || 'text'
})

// Fetch file content using useFetch with computed URL
const { data: fileData, pending: loading, error: fileError, refresh: refreshFile } = await useFetch(
  () => {
    if (!hasFile.value || !filePath.value || isImage.value) return null
    const branch = selectedBranch.value || 'main'
    return `/api/projects/${projectId.value}/file?path=${encodeURIComponent(filePath.value)}&branch=${branch}`
  },
  {
    key: computed(() => `file-${projectId.value}-${filePath.value}-${selectedBranch.value || 'main'}`),
    server: true,
    lazy: false,
    immediate: true
  }
)

// Extract file content from response
const fileContent = computed(() => fileData.value?.content || '')

// Load comments when file changes
watch([projectId, filePath], async () => {
  if (hasFile.value && filePath.value) {
    // Close any open comment box when switching files
    console.log('[watch] Closing comment box, switching to file:', filePath.value)
    closeCommentBox()
    await loadComments(projectId.value, filePath.value)
  }
})

// Initialize line positions when file content loads
watch([hasFile, fileContent, markdownMode], async () => {
  await nextTick()
  await nextTick() // Double nextTick to ensure DOM is rendered
  
  
  if (isMarkdown.value && markdownMode.value === 'render' && markdownRef.value && scrollContainerRef.value) {
    initializeLinePositions(markdownRef.value, scrollContainerRef.value)
  }
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

function autoResizeHtmlPreview() {
  if (!htmlPreviewRef.value) return
  try {
    const doc = htmlPreviewRef.value.contentDocument
    if (doc && doc.body) {
      htmlPreviewRef.value.style.height = doc.body.scrollHeight + 'px'
    }
  } catch {}
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

function getPositionByLineNumber(lineNumber: number): number | null {
  // Use the line positions composable for markdown rendered mode
  if (isMarkdown.value && markdownMode.value === 'render') {
    return getLinePosition(lineNumber)
  }
  
  // For code view, use traditional approach
  if (!contentRef.value || !scrollContainerRef.value) return null
  
  const containerRect = scrollContainerRef.value.getBoundingClientRect()
  const codeBlock = contentRef.value.querySelector('pre code')
  
  if (codeBlock) {
    const lineSpans = codeBlock.querySelectorAll('.block')
    if (lineSpans.length >= lineNumber && lineNumber > 0) {
      const lineEl = lineSpans[lineNumber - 1]
      const rect = lineEl.getBoundingClientRect()
      return rect.top - containerRect.top + scrollContainerRef.value.scrollTop
    }
    // Line doesn't exist, use last available line
    if (lineSpans.length > 0) {
      const lastLineEl = lineSpans[lineSpans.length - 1]
      const rect = lastLineEl.getBoundingClientRect()
      return rect.top - containerRect.top + scrollContainerRef.value.scrollTop
    }
  }
  return null
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
  void updateCount.value  // Recalculate when line positions update
  
  
  // Log each comment's line number
  sortedComments.value.forEach(c => {
  })
  
  const positions: Record<string, number> = {}
  const minCommentHeight = 150 // Minimum height for a comment box
  const margin = 40 // Margin between comments
  
  // Track placed comments and their bottom positions
  const placedComments: { id: string; top: number; bottom: number }[] = []
  
  // Position all comments (interpolation handles missing lines)
  for (const comment of sortedComments.value) {
    const baseTop = getPositionByLineNumber(comment.lineNumber || 1)
    const height = commentBoxHeights.value[comment.id] || minCommentHeight
    
    
    if (baseTop !== null) {
      // Adjust position to prevent overlap
      let adjustedTop = baseTop
      for (const placed of placedComments) {
        if (adjustedTop < placed.bottom + margin) {
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
  }
  
  return positions
})

// Track orphaned comment IDs (only if file is completely empty)
const orphanedCommentIds = computed(() => {
  void commentPositionsVersion.value
  void updateCount.value
  
  const ids = new Set<string>()
  
  for (const comment of sortedComments.value) {
    const baseTop = getPositionByLineNumber(comment.lineNumber || 1)
    if (baseTop === null) {
      ids.add(comment.id)
    }
  }
  
  return ids
})

function isOrphaned(comment: any): boolean {
  return orphanedCommentIds.value.has(comment.id)
}

const getCommentTop = (comment: any): number => {
  return commentPositions.value[comment.id] ?? 0
}

// Load project and tree
onMounted(async () => {
  await loadProject()
  await loadTree(projectId.value)
  syncBranchFromUrl()
  
  // Set selectedFile and expand tree from URL path if file is specified
  if (filePath.value) {
    const fileName = filePath.value.split('/').pop() || ''
    selectFile({ path: filePath.value, name: fileName, type: 'file' })
    expandToPath(filePath.value)
    
    // Load comments for the file
    await loadComments(projectId.value, filePath.value)
  }
  
  
  // Initialize line positions after DOM is ready
  await nextTick()
  await nextTick()
  if (isMarkdown.value && markdownMode.value === 'render' && markdownRef.value && scrollContainerRef.value) {
    initializeLinePositions(markdownRef.value, scrollContainerRef.value)
  }
})

async function loadProject() {
  try {
    project.value = await $fetch(`/api/projects/${projectId.value}`)
  } catch (e) {
  }
}

function handleSelectFile(item: { path: string; name: string; type: string }) {
  if (item.type === 'file') {
    // Close any open comment box when switching files
    closeCommentBox()
    
    // Update selectedFile state
    selectFile(item as any)
    
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
  // Re-scan line positions when switching modes
  if (isMarkdown.value && markdownMode.value === 'render' && markdownRef.value && scrollContainerRef.value) {
    initializeLinePositions(markdownRef.value, scrollContainerRef.value)
  }
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
  await refreshFile()
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

function handleEditComment(commentId: string, newText: string) {
  editComment(commentId, newText)
}

function scrollToCommentLine(comment: any) {
  // Check if this comment is orphaned
  const isCommentOrphaned = orphanedCommentIds.value.has(comment.id)
  
  if (isCommentOrphaned) {
    return
  }
  
  const top = getCommentTop(comment)
  
  if (top === null || top === undefined) {
    return
  }
  
  const scrollTarget = Math.max(0, top - 100)
  
  // Try scrollContainerRef first
  if (scrollContainerRef.value && scrollContainerRef.value.scrollHeight > scrollContainerRef.value.clientHeight) {
    scrollContainerRef.value.scrollTo({ top: scrollTarget, behavior: 'smooth' })
    return
  }
  
  // Fallback: scroll the window/body
  window.scrollTo({ top: scrollTarget, behavior: 'smooth' })
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
  <!-- Main Content -->
  <div class="h-full flex">
    <!-- File Tree Sidebar (desktop only) -->
    <div class="hidden md:block shrink-0 h-full">
      <FileTree 
        :projectId="projectId"
        v-model:sidebarOpen="sidebarOpen"
        @selectFile="handleSelectFile"
        @showFileMenu="showFileMenu"
      />
    </div>

    <!-- Main Content Area with Comments -->
    <div class="flex-1 flex min-w-0 flex-col min-h-0 pb-14 md:pb-0">
      <!-- File Header (Fixed, no scroll) -->
      <div ref="breadcrumbBar" class="flex shrink-0 border-b border-gray-200 bg-white overflow-y-auto" style="scrollbar-gutter: stable">
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
          <div v-else-if="hasFile && isHtml" class="flex md:hidden items-center gap-1">
            <button 
              @click="htmlMode = 'render'"
              class="px-2 py-1 text-xs rounded-lg transition-colors"
              :class="htmlMode === 'render' ? 'bg-red-100 text-red-600' : 'text-gray-500 hover:bg-gray-100'"
            >
              View
            </button>
            <button 
              @click="htmlMode = 'source'"
              class="px-2 py-1 text-xs rounded-lg transition-colors"
              :class="htmlMode === 'source' ? 'bg-red-100 text-red-600' : 'text-gray-500 hover:bg-gray-100'"
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
            <div v-else-if="hasFile && isHtml" class="flex items-center gap-2">
              <button 
                @click="htmlMode = 'render'"
                class="px-3 py-1 text-sm rounded-lg transition-colors"
                :class="htmlMode === 'render' ? 'bg-red-100 text-red-600' : 'text-gray-500 hover:bg-gray-100'"
              >
                View
              </button>
              <button 
                @click="htmlMode = 'source'"
                class="px-3 py-1 text-sm rounded-lg transition-colors"
                :class="htmlMode === 'source' ? 'bg-red-100 text-red-600' : 'text-gray-500 hover:bg-gray-100'"
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
      <div ref="scrollContainerRef" class="flex-1 overflow-auto bg-white h-0" style="scrollbar-gutter: stable">
        <div class="flex min-h-full">
          <!-- File Content -->
          <div ref="contentRef" class="flex-1 min-w-0 p-4 md:p-6 bg-white relative">
            <!-- Loading -->
            <div v-if="loading" class="text-gray-400 text-center py-8">Loading...</div>
            
            <!-- Empty State (no file selected) -->
            <div v-else-if="!hasFile" class="text-gray-400 text-center py-16">
              <Icon name="i-lucide-file-text" class="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Select a file from the tree to view its contents</p>
            </div>
            
            <!-- Image View -->
            <div v-else-if="isImage" class="flex items-center justify-center p-8">
              <img 
                :src="imageUrl" 
                :alt="selectedFile?.name || 'Image'"
                class="max-w-full max-h-[80vh] object-contain rounded shadow-lg"
              />
            </div>
            
            <!-- Markdown Rendered -->
            <div 
              v-else-if="isMarkdown && markdownMode === 'render'" 
              ref="markdownRef"
              class="prose prose-sm max-w-none select-text"
              v-html="renderedMarkdown"
            />
            
            <!-- HTML Rendered (sandboxed iframe) -->
            <iframe
              v-else-if="isHtml && htmlMode === 'render'"
              ref="htmlPreviewRef"
              :srcdoc="fileContent"
              sandbox="allow-same-origin"
              class="html-preview w-full border-0 rounded-lg"
              @load="autoResizeHtmlPreview"
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
              :isOrphaned="isOrphaned"
              @save="handleSaveComment"
              @cancel="closeCommentBoxLocal"
              @delete="handleDeleteComment"
              @edit="handleEditComment"
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