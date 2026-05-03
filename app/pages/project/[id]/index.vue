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
      token.attrSet('data-line', String(token.map[0] + 1))
    }
  }
})

import 'highlight.js/styles/github.css'

definePageMeta({
  layout: 'project'
})

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const filePath = computed(() => {
  const path = route.params.path
  console.log('[Project Page - index] route.params:', route.params)
  console.log('[Project Page - index] path:', path)
  if (Array.isArray(path)) {
    return path.join('/')
  }
  return path || ''
})

// Log on mount
onMounted(() => {
  console.log('[Project Page] Mounted')
  console.log('[Project Page] projectId:', projectId.value)
  console.log('[Project Page] filePath:', filePath.value)
})

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

// Computed: has file selected
const hasFile = computed(() => !!filePath.value)

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

function getPositionByLineNumber(lineNumber: number): number {
  if (!contentRef.value || !scrollContainerRef.value) return 0
  const containerRect = scrollContainerRef.value.getBoundingClientRect()

  if (isMarkdown.value && markdownMode.value === 'render' && markdownRef.value) {
    const el = markdownRef.value.querySelector(`[data-line="${lineNumber}"]`)
    if (el) {
      const rect = el.getBoundingClientRect()
      return rect.top - containerRect.top + scrollContainerRef.value.scrollTop
    }
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

const getCommentTop = (comment: any): number => {
  void commentPositionsVersion.value
  return getPositionByLineNumber(comment.lineNumber || 1)
}

// Load project and file
onMounted(async () => {
  await loadProject()
  await loadTree(projectId.value)
  if (filePath.value) {
    await loadFileFromPath(filePath.value)
  }
})

watch(filePath, async (newPath, oldPath) => {
  if (newPath && newPath !== oldPath) {
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
    router.push(`/project/${projectId.value}/${item.path}`)
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
        const rect = rects[0]
        toolbarPosition.value = {
          top: rect.top - 45,
          left: rect.left + rect.width / 2 - 50
        }
        if (scrollContainerRef.value) {
          const containerRect = scrollContainerRef.value.getBoundingClientRect()
          commentBoxTop.value = rect.top - containerRect.top + scrollContainerRef.value.scrollTop
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

watch(markdownMode, async () => {
  await nextTick()
  commentPositionsVersion.value++
  updateContentHeight()
})

async function handleSaveComment() {
  if (!commentText.value.trim() || !selectedFile.value?.path) return
  await saveComment(projectId.value, selectedFile.value.path, selectedLineNumber.value)
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
  await loadCommentCounts(projectId.value)
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

watch(() => comments.value.length, () => {
  if (currentCommentIndex.value >= comments.value.length) {
    currentCommentIndex.value = Math.max(0, comments.value.length - 1)
  }
})

function showFileMenu(event: MouseEvent, item: any) {
  // TODO
}
</script>

<template>
  <div class="flex-1 flex min-h-0 relative">
    <!-- DEBUG: Show route info (index page) -->
    <div class="fixed top-0 left-0 right-0 bg-yellow-100 p-2 text-xs z-50">
      DEBUG (index): route.params = {{ JSON.stringify(route.params) }} | projectId = {{ projectId }} | filePath = {{ filePath }} | hasFile = {{ hasFile }}
    </div>
    
    <!-- File Tree Sidebar (desktop) -->
    <FileTree 
      :projectId="projectId"
      v-model:sidebarOpen="sidebarOpen"
      @selectFile="handleSelectFile"
      @showFileMenu="showFileMenu"
      class="hidden md:block"
    />

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
          
          <div class="hidden md:flex items-center gap-3">
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

        <CommentsHeader
          v-if="hasFile"
          :comments="comments"
          :sortedComments="sortedComments"
          :currentCommentIndex="currentCommentIndex"
          @navigate="navigateComment"
          class="hidden md:block"
        />
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
              v-html="md.render(fileContent)"
            />
            
            <!-- Code View -->
            <pre v-else-if="hasFile" class="text-sm leading-6 hljs overflow-x-auto"><code class="language-typescript"><template v-for="(line, i) in highlightedLines" :key="i"><span class="block" :class="commentedLines.has(i + 1) ? 'bg-red-50 border-l-2 border-red-400' : ''"><span class="text-gray-400 select-none pr-4 inline-block w-12 text-right">{{ i + 1 }}</span><span v-html="line || '&nbsp;'"></span></span></template></code></pre>
          </div>

          <!-- Comments Column (desktop) -->
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
            @cancel="closeCommentBox"
            @delete="handleDeleteComment"
            @clickComment="handleClickComment"
            class="hidden md:block"
          />
          
          <!-- Empty Comments Sidebar (no file) -->
          <aside v-else class="hidden md:block w-80 shrink-0 border-l border-gray-200 bg-white">
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
        class="flex-1 py-3 flex items-center justify-center gap-2 text-sm relative"
        :class="mobileTab === 'comments' ? 'text-red-600 bg-red-50' : 'text-gray-600'"
      >
        <Icon name="i-lucide-message-square" class="w-5 h-5" />
        Comments
        <span 
          v-if="comments.length > 0" 
          class="absolute top-2 right-1/4 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
        >
          {{ comments.length }}
        </span>
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
            <FileTree 
              :projectId="projectId"
              :sidebarOpen="true"
              @selectFile="(item) => { handleSelectFile(item); mobileTab = null }"
              @showFileMenu="showFileMenu"
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
            <CommentInput 
              v-if="showCommentBox"
              v-model:commentText="commentText"
              :selectedText="selectedText"
              :top="0"
              position="static"
              @save="handleSaveComment"
              @cancel="closeCommentBox"
            />
            
            <div v-if="sortedComments.length > 0" class="space-y-3">
              <div 
                v-for="(comment, idx) in sortedComments" 
                :key="comment.id"
                class="p-3 bg-gray-50 rounded-lg border"
                :class="idx === currentCommentIndex ? 'border-red-300 bg-red-50' : 'border-gray-200'"
                @click="handleClickComment(comment); mobileTab = null"
              >
                <div class="text-xs text-gray-400 mb-1">Line {{ comment.lineNumber }}</div>
                <div class="text-sm text-gray-700">{{ comment.text }}</div>
              </div>
            </div>
            
            <div v-else-if="!showCommentBox" class="text-gray-400 text-sm text-center py-8">
              Select text in the file to add a comment.
            </div>
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