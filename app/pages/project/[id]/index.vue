<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useTextSelection } from '@vueuse/core'
import hljs from 'highlight.js'
import MarkdownIt from 'markdown-it'

// Configure markdown-it with highlight.js
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
  loadComments,
  openCommentBox,
  closeCommentBox,
  saveComment,
  deleteComment
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
const sidebarRef = ref(null)
const sidebarOpen = ref(true)
const showToolbar = ref(false)
const toolbarPosition = ref({ top: 0, left: 0 })

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

const lines = computed(() => {
  return fileContent.value.split('\n')
})

// Load project and file
onMounted(async () => {
  await loadProject()
  await loadTree(projectId.value)
  
  // If we have a file path in URL, load that file
  if (filePath.value) {
    const item = {
      name: filePath.value.split('/').pop() || '',
      path: filePath.value,
      type: 'file' as const,
      depth: 0
    }
    await loadFile(item)
  }
})

// Watch for route changes
watch(filePath, async (newPath) => {
  if (newPath && selectedFile.value?.path !== newPath) {
    const item = {
      name: newPath.split('/').pop() || '',
      path: newPath,
      type: 'file' as const,
      depth: 0
    }
    await loadFile(item)
  }
})

async function loadProject() {
  try {
    project.value = await $fetch(`/api/projects/${projectId.value}`)
  } catch (e) {
    console.error('Failed to load project:', e)
  }
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
  }
}

function handleSelectFile(item: { path: string; name: string; type: string }) {
  if (item.type === 'file') {
    // Update URL
    router.push(`/project/${projectId.value}/${item.path}`)
    loadFile(item)
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
        
        // Toolbar position (fixed, viewport coordinates)
        toolbarPosition.value = {
          top: rect.top - 45,
          left: rect.left + rect.width / 2 - 50
        }
        
        // Comment box position: same document Y as selected text
        const textDocumentY = rect.top + window.scrollY
        commentBoxTop.value = Math.max(16, textDocumentY - 100)
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

async function handleSaveComment() {
  if (!commentText.value.trim() || !selectedFile.value?.path) return
  const lineNum = findLineNumber(selectedText.value)
  await saveComment(projectId.value, selectedFile.value.path, lineNum)
}

function findLineNumber(text: string): number {
  if (!fileContent.value || !text) return 1
  const index = fileContent.value.indexOf(text)
  if (index === -1) return 1
  return fileContent.value.substring(0, index).split('\n').length
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// File menu (context menu)
const fileMenuRef = ref(null)
const fileMenuPosition = ref({ x: 0, y: 0 })
const fileMenuVisible = ref(false)
const fileMenuTarget = ref<any>(null)

function showFileMenu(event: MouseEvent, item: any) {
  fileMenuPosition.value = { x: event.clientX, y: event.clientY }
  fileMenuTarget.value = item
  fileMenuVisible.value = true
}

// Branch change
async function onBranchChange() {
  await loadTree(projectId.value)
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

    <!-- Main Content Area -->
    <div class="flex-1 flex min-w-0">
      <!-- Content Section -->
      <div class="flex-1 min-w-0 flex flex-col">
        <!-- File Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-gray-400">{{ project?.fullName }}</span>
            <span class="text-gray-300">/</span>
            <span class="text-gray-500">Select a file to view</span>
          </div>
        </div>

        <!-- Empty State -->
        <div class="flex-1 flex items-center justify-center">
          <div class="text-gray-400 text-center">
            <Icon name="i-lucide-file-text" class="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Select a file from the tree to view its contents</p>
          </div>
        </div>
      </div>

      <!-- Comments Sidebar -->
      <aside class="w-80 shrink-0 border-l border-gray-200 bg-white">
        <div class="p-4">
          <h3 class="text-xs font-semibold text-gray-500 uppercase mb-3">Comments</h3>
          <div class="text-gray-400 text-sm text-center py-8">
            Select a file to view comments.
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
