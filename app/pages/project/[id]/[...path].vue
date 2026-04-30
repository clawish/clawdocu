<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useTextSelection } from '@vueuse/core'
import hljs from 'highlight.js'
import MarkdownIt from 'markdown-it'

// Configure markdown-it with highlight.js and line tracking
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>'
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
  }
})

// Plugin: add data-line attributes to block elements for comment positioning
md.core.ruler.push('line_numbers', (state) => {
  for (const token of state.tokens) {
    if (token.map && token.type.endsWith('_open')) {
      token.attrSet('data-line', String(token.map[0] + 1)) // 1-indexed to match findLineNumber
    }
  }
})

// Import highlight.js styles
import 'highlight.js/styles/github.css'

definePageMeta({
  layout: 'project'
})

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const filePath = computed(() => (route.params.path as string[])?.join('/') || '')

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
  toggleFolder,
  selectFile,
  changeBranch,
  getFileIcon
} = useFileTree()

// Local state
const project = ref(null)
const fileContent = ref('')
const loading = ref(true)
const markdownMode = ref('render')
const markdownRef = ref(null)
const contentRef = ref(null)
const scrollContainerRef = ref(null)
const sidebarOpen = ref(true)
const showToolbar = ref(false)
const toolbarPosition = ref({ top: 0, left: 0 })
// Bump this to force getCommentTop re-computation after mode change or scroll
const commentPositionsVersion = ref(0)
// Line number captured at selection time (from DOM, not from text search)
const selectedLineNumber = ref(1)
// Current comment index for up/down navigation
const currentCommentIndex = ref(0)

// Find line number from the current DOM selection using data-line attributes
function findLineNumberFromDOM(): number {
  if (isMarkdown.value && markdownMode.value === 'render' && markdownRef.value) {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      let node: Node | null = range.startContainer
      // Walk up from selection start to find the closest element with data-line
      while (node && node !== markdownRef.value) {
        if (node instanceof Element && node.hasAttribute('data-line')) {
          return parseInt(node.getAttribute('data-line') || '1', 10)
        }
        node = node.parentElement
      }
    }
  }
  return 0 // 0 means DOM lookup failed, fall back to text search
}

// Text selection from VueUse
const textSelection = useTextSelection()

// Computed
const isMarkdown = computed(() => {
  const ext = selectedFile.value?.name?.split('.').pop()?.toLowerCase()
  return ext === 'md' || ext === 'markdown'
})

const filePathSegments = computed(() => {
  return selectedFile.value?.path?.split('/').filter(Boolean) || []
})

// Get file extension for syntax highlighting
const fileExtension = computed(() => {
  const ext = selectedFile.value?.name?.split('.').pop()?.toLowerCase()
  return ext || 'text'
})

// Get language for highlight.js
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

// Highlighted code lines
const highlightedLines = computed(() => {
  if (!fileContent.value) return []
  
  const lang = getHighlightLanguage(fileExtension.value)
  
  // Highlight entire file, then split by line
  try {
    const highlighted = hljs.highlight(fileContent.value, { language: lang, ignoreIllegals: true }).value
    // Split by <br> or newlines in the highlighted output
    return highlighted.split('\n')
  } catch (e) {
    return fileContent.value.split('\n')
  }
})

// Raw lines for height calculation
const lines = computed(() => {
  return fileContent.value.split('\n')
})

// Reactive content height for comments column minHeight sync
const contentHeight = ref(0)

function updateContentHeight() {
  if (contentRef.value) {
    contentHeight.value = contentRef.value.scrollHeight
  }
}

// Lines with comments (for highlighting)
const commentedLines = computed(() => {
  const lineSet = new Set<number>()
  for (const comment of comments.value) {
    if (comment.lineNumber) {
      lineSet.add(comment.lineNumber)
    }
  }
  return lineSet
})

// Get the vertical position for a comment relative to the scroll container's content top
function getPositionByLineNumber(lineNumber: number): number {
  if (!contentRef.value || !scrollContainerRef.value) return 0

  const containerRect = scrollContainerRef.value.getBoundingClientRect()

  if (isMarkdown.value && markdownMode.value === 'render' && markdownRef.value) {
    // For rendered markdown, find the block element with matching data-line
    // data-line attributes are 1-indexed (set by our markdown-it plugin)
    const el = markdownRef.value.querySelector(`[data-line="${lineNumber}"]`)
    if (el) {
      const rect = el.getBoundingClientRect()
      return rect.top - containerRect.top + scrollContainerRef.value.scrollTop
    }
    // If exact line not found, find the nearest earlier line
    const allLineEls = markdownRef.value.querySelectorAll('[data-line]')
    let closestEl: Element | null = null
    let closestLine = 0
    for (const lineEl of allLineEls) {
      const elLine = parseInt(lineEl.getAttribute('data-line') || '0', 10)
      if (elLine <= lineNumber && elLine > closestLine) {
        closestLine = elLine
        closestEl = lineEl
      }
    }
    if (closestEl) {
      const rect = closestEl.getBoundingClientRect()
      return rect.top - containerRect.top + scrollContainerRef.value.scrollTop
    }
    return 0
  }

  // For code/raw view, find the line span by line number
  const codeBlock = contentRef.value.querySelector('pre code')
  if (codeBlock) {
    const lineSpans = codeBlock.querySelectorAll('.block')
    if (lineSpans.length >= lineNumber && lineNumber > 0) {
      const lineEl = lineSpans[lineNumber - 1]
      const rect = lineEl.getBoundingClientRect()
      return rect.top - containerRect.top + scrollContainerRef.value.scrollTop
    }
  }

  // Fallback: compute from line number assuming 24px line height + 24px padding
  return (lineNumber - 1) * 24 + 24
}

// Get comment position — recalculated on mode change via commentPositionsVersion
const getCommentTop = (comment: any): number => {
  // Touch version ref to make this reactive on mode switch
  void commentPositionsVersion.value
  return getPositionByLineNumber(comment.lineNumber || 1)
}

// Load project and file
onMounted(async () => {
  await loadProject()
  await loadTree(projectId.value)
  
  // Load file from URL path
  if (filePath.value) {
    await loadFileFromPath(filePath.value)
  }
})

// Watch for route changes
watch(filePath, async (newPath) => {
  if (newPath) {
    await loadFileFromPath(newPath)
  }
})

async function loadProject() {
  try {
    project.value = await $fetch(`/api/projects/${projectId.value}`)
  } catch (e) {
    console.error('Failed to load project:', e)
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
  if (item.type !== 'file') return
  
  loading.value = true
  selectFile(item as any)
  
  try {
    const response = await $fetch(`/api/projects/${projectId.value}/file`, {
      query: { path: item.path, branch: selectedBranch.value }
    })
    fileContent.value = response.content || ''
    
    // Load comments for this file
    await loadComments(projectId.value, item.path)
  } catch (e) {
    console.error('Failed to load file:', e)
  } finally {
    loading.value = false
    await nextTick()
    updateContentHeight()
  }
}

function handleSelectFile(item: { path: string; name: string; type: string }) {
  if (item.type === 'file') {
    // Update URL
    router.push(`/project/${projectId.value}/${item.path}`)
  } else {
    toggleFolder(item.path)
  }
}

// Text selection handling
watch(
  () => textSelection.text.value,
  (text) => {
    if (text && text.length >= 2) {
      selectedText.value = text
      const rects = textSelection.rects.value
      if (rects && rects.length > 0) {
        const rect = rects[0]
        
        toolbarPosition.value = {
          top: rect.top - 45,
          left: rect.left + rect.width / 2 - 50
        }
        
        // Calculate comment box top relative to scroll container content area
        if (scrollContainerRef.value) {
          const containerRect = scrollContainerRef.value.getBoundingClientRect()
          commentBoxTop.value = rect.top - containerRect.top + scrollContainerRef.value.scrollTop
        }
      }

      // Determine line number at selection time when the DOM selection is still valid
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

// When markdown mode changes, recalculate comment positions and update comment box position
watch(markdownMode, async () => {
  await nextTick()
  commentPositionsVersion.value++
  updateContentHeight()
})

async function handleSaveComment() {
  if (!commentText.value.trim() || !selectedFile.value?.path) return
  await saveComment(projectId.value, selectedFile.value.path, selectedLineNumber.value)
  // Refresh comment counts in sidebar and positions
  await loadCommentCounts(projectId.value)
  await nextTick()
  commentPositionsVersion.value++
  updateContentHeight()
}

const syncing = ref(false)

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
  
  // Try exact match first
  let index = fileContent.value.indexOf(text)
  if (index !== -1) {
    return fileContent.value.substring(0, index).split('\n').length
  }
  
  // For markdown rendered mode, try to find by trimming whitespace
  const trimmedText = text.trim()
  index = fileContent.value.indexOf(trimmedText)
  if (index !== -1) {
    return fileContent.value.substring(0, index).split('\n').length
  }
  
  // Try case-insensitive search
  const lowerContent = fileContent.value.toLowerCase()
  const lowerText = text.toLowerCase()
  index = lowerContent.indexOf(lowerText)
  if (index !== -1) {
    return fileContent.value.substring(0, index).split('\n').length
  }
  
  console.log('[findLineNumber] Could not find text:', text)
  return 1
}


function handleClickComment(comment: any) {
  const idx = sortedComments.value.findIndex(c => c.id === comment.id)
  if (idx >= 0) currentCommentIndex.value = idx
  scrollToCommentLine(comment)
}

async function handleDeleteComment(commentId: string) {
  await deleteComment(projectId.value, commentId)
  // Refresh comment counts in sidebar and positions
  await loadCommentCounts(projectId.value)
  await nextTick()
  commentPositionsVersion.value++
  updateContentHeight()
  // Clamp index after deletion
  if (currentCommentIndex.value >= sortedComments.value.length) {
    currentCommentIndex.value = sortedComments.value.length - 1
  }
}

// Scroll the content area to show the line for a given comment
function scrollToCommentLine(comment: any) {
  const top = getPositionByLineNumber(comment.lineNumber || 1)
  if (scrollContainerRef.value) {
    scrollContainerRef.value.scrollTo({ top: Math.max(0, top - 100), behavior: 'smooth' })
  }
}

// Navigate to next/previous comment and scroll content to it
function navigateComment(direction: 1 | -1) {
  const total = sortedComments.value.length
  if (total === 0) return

  let newIndex = currentCommentIndex.value + direction
  
  // Wrap around
  if (newIndex < 0) newIndex = total - 1
  if (newIndex >= total) newIndex = 0

  currentCommentIndex.value = newIndex

  const comment = sortedComments.value[currentCommentIndex.value]
  if (comment) {
    scrollToCommentLine(comment)
  }
}

// Reset comment index when comments change
watch(() => comments.value.length, () => {
  if (currentCommentIndex.value >= comments.value.length) {
    currentCommentIndex.value = Math.max(0, comments.value.length - 1)
  }
})

// File menu
function showFileMenu(event: MouseEvent, item: any) {
  // TODO: implement context menu
}
</script>

<template>
  <div class="flex-1 flex min-h-0">
    <!-- File Tree Sidebar -->
    <FileTree 
      :projectId="projectId"
      v-model:sidebarOpen="sidebarOpen"
      @selectFile="handleSelectFile"
      @showFileMenu="showFileMenu"
    />

    <!-- Main Content Area with Comments -->
    <div class="flex-1 flex min-w-0 flex-col">
      <!-- File Header — spans content + comments columns -->
      <div class="flex shrink-0 border-b border-gray-200 bg-white overflow-y-auto" style="scrollbar-gutter: stable">
        <!-- Left: file path + actions -->
        <div class="flex-1 min-w-0 flex items-center justify-between px-4 py-3">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-gray-400">{{ project?.fullName }}</span>
            <span class="text-gray-300">/</span>
            <span 
              v-for="(segment, i) in filePathSegments" 
              :key="i" 
              class="flex items-center gap-2"
            >
              <span class="text-gray-700">{{ segment }}</span>
              <span v-if="i < filePathSegments.length - 1" class="text-gray-300">/</span>
            </span>
          </div>
          
          <div class="flex items-center gap-3">
            <!-- Sync button -->
            <button 
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

            <!-- Markdown mode toggle -->
            <div v-if="isMarkdown" class="flex items-center gap-2">
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

            <!-- View on GitHub -->
            <a 
              v-if="project?.fullName"
              :href="`https://github.com/${project.fullName}/blob/main/${filePath}`" 
              target="_blank"
              class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Icon name="i-lucide-github" class="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>

        <!-- Right: Comments title with navigation (same width as comments column) -->
        <CommentsHeader
          :comments="comments"
          :sortedComments="sortedComments"
          :currentCommentIndex="currentCommentIndex"
          @navigate="navigateComment"
        />
      </div>

      <!-- Scrollable Content + Comments Container (single scroll) -->
      <div ref="scrollContainerRef" class="flex-1 overflow-auto bg-white" style="scrollbar-gutter: stable">
        <div class="flex min-h-full">
          <!-- File Content -->
          <div ref="contentRef" class="flex-1 min-w-0 p-6 bg-white">
            <div v-if="loading" class="text-gray-400 text-center py-8">Loading...</div>
            
            <!-- Markdown Rendered -->
            <div 
              v-else-if="isMarkdown && markdownMode === 'render'" 
              ref="markdownRef"
              class="prose prose-sm max-w-none select-text"
              v-html="md.render(fileContent)"
            />
            
            <!-- Code View -->
            <pre v-else class="text-sm leading-6 hljs"><code class="language-typescript"><template v-for="(line, i) in highlightedLines" :key="i"><span class="block" :class="commentedLines.has(i + 1) ? 'bg-red-50 border-l-2 border-red-400' : ''"><span class="text-gray-400 select-none pr-4 inline-block w-12 text-right">{{ i + 1 }}</span><span v-html="line || '&nbsp;'"></span></span></template></code></pre>
          </div>

          <!-- Comments Column (scrolls with content) -->
          <CommentsSidebar
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
            @cancel="closeCommentBox"
            @delete="handleDeleteComment"
              @clickComment="handleClickComment"
            />
          </div>
        </div>
      </div>

    <!-- Text Selection Toolbar -->
    <Teleport to="body">
      <div 
        v-if="showToolbar"
        class="fixed bg-white border border-gray-200 rounded-lg shadow-lg px-2 py-1 flex items-center gap-2 z-50"
        :style="{ top: toolbarPosition.top + 'px', left: toolbarPosition.left + 'px' }"
      >
        <button 
          @click="openCommentBoxLocal"
          class="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
        >
          <Icon name="i-lucide-message-square-plus" class="w-4 h-4" />
          <span>Comment</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
