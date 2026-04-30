// File tree state management composable
import type { Ref } from 'vue'

export interface TreeItem {
  name: string
  path: string
  type: 'file' | 'dir'
  depth: number
}

export interface FileTreeState {
  treeData: Ref<any[]>
  expandedPaths: Ref<Set<string>>
  selectedFile: Ref<{ path: string; name: string } | null>
  loading: Ref<boolean>
  branches: Ref<string[]>
  selectedBranch: Ref<string>
  commentCounts: Ref<Record<string, number>>
}

// Singleton state
const treeData = ref<any[]>([])
const expandedPaths = ref(new Set<string>())
const selectedFile = ref<{ path: string; name: string } | null>(null)
const loading = ref(true)
const branches = ref(['main'])
const selectedBranch = ref('main')
const commentCounts = ref<Record<string, number>>({})

export const useFileTree = () => {
  // Load file tree from GitHub
  const loadTree = async (projectId: string, branch?: string) => {
    // Only show loading state on initial load, not on refreshes
    if (treeData.value.length === 0) {
      loading.value = true
    }
    try {
      // On first load (no explicit branch), don't send branch param
      // so the API can use the repo's actual default branch
      const query: Record<string, string> = {}
      if (branch) {
        query.branch = branch
      }
      
      const response = await $fetch(`/api/projects/${projectId}/tree`, {
        query
      })
      treeData.value = response.tree || []
      branches.value = response.branches || ['main']
      // Always set selected branch to default on first load
      if (response.defaultBranch && treeData.value.length > 0) {
        selectedBranch.value = response.defaultBranch
      }
      
      // Load comment counts
      await loadCommentCounts(projectId)
    } catch (e) {
      console.error('Failed to load tree:', e)
      treeData.value = []
    } finally {
      loading.value = false
    }
  }

  // Load comment counts for all files
  const loadCommentCounts = async (projectId: string) => {
    try {
      const response = await $fetch(`/api/projects/${projectId}/comment-counts`)
      commentCounts.value = response.counts || {}
    } catch (e) {
      console.error('Failed to load comment counts:', e)
    }
  }

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    if (expandedPaths.value.has(path)) {
      expandedPaths.value.delete(path)
    } else {
      expandedPaths.value.add(path)
    }
    // Trigger reactivity
    expandedPaths.value = new Set(expandedPaths.value)
  }

  // Select a file
  const selectFile = (item: TreeItem) => {
    if (item.type === 'file') {
      selectedFile.value = { path: item.path, name: item.name }
    }
  }

  // Change branch
  const changeBranch = async (projectId: string, branch: string) => {
    selectedBranch.value = branch
    await loadTree(projectId, branch)
  }

  // Flatten tree for rendering
  const flatTree = computed(() => {
    const result: TreeItem[] = []
    
    function flatten(items: any[], depth = 0) {
      for (const item of items) {
        result.push({
          name: item.name,
          path: item.path,
          type: item.type,
          depth
        })
        
        if (item.type === 'dir' && expandedPaths.value.has(item.path) && item.children) {
          flatten(item.children, depth + 1)
        }
      }
    }
    
    flatten(treeData.value)
    return result
  })

  // Aggregate comment counts for directories (sum of all nested files)
  const directoryCommentCounts = computed(() => {
    const counts: Record<string, number> = {}
    for (const [filePath, count] of Object.entries(commentCounts.value)) {
      if (!count) continue
      const parts = filePath.split('/')
      // Aggregate into each parent directory
      for (let i = 1; i < parts.length; i++) {
        const dirPath = parts.slice(0, i).join('/')
        counts[dirPath] = (counts[dirPath] || 0) + count
      }
    }
    return counts
  })

  // Get file icon based on filename and extension
  const getFileIcon = (filename: string): string => {
    const lower = filename.toLowerCase()

    // Match full filename first (for dotfiles and special files without extensions)
    const filenameIcons: Record<string, string> = {
      'dockerfile': 'i-lucide-box',
      'makefile': 'i-lucide-file-cog',
      'readme': 'i-lucide-file-text',
      'license': 'i-lucide-file-text',
      'changelog': 'i-lucide-file-text',
      '.gitignore': 'i-lucide-git-branch',
      '.dockerignore': 'i-lucide-box',
      '.env': 'i-lucide-lock',
      '.env.local': 'i-lucide-lock',
      '.env.development': 'i-lucide-lock',
      '.env.production': 'i-lucide-lock',
      '.env.test': 'i-lucide-lock',
      '.eslintrc': 'i-lucide-file-cog',
      '.prettierrc': 'i-lucide-file-cog',
      '.babelrc': 'i-lucide-file-cog',
      '.npmrc': 'i-lucide-file-cog',
      '.editorconfig': 'i-lucide-file-cog',
      '.github': 'i-lucide-git-branch',
    }
    if (filenameIcons[lower]) return filenameIcons[lower]

    // Match by extension (after the last dot)
    const ext = lower.split('.').pop() || ''
    const extIcons: Record<string, string> = {
      'ts': 'i-lucide-file-type',
      'tsx': 'i-lucide-file-type',
      'js': 'i-lucide-file-type',
      'jsx': 'i-lucide-file-type',
      'mjs': 'i-lucide-file-type',
      'cjs': 'i-lucide-file-type',
      'vue': 'i-lucide-file-code',
      'svelte': 'i-lucide-file-code',
      'json': 'i-lucide-file-json',
      'md': 'i-lucide-file-text',
      'markdown': 'i-lucide-file-text',
      'css': 'i-lucide-file-code',
      'scss': 'i-lucide-file-code',
      'less': 'i-lucide-file-code',
      'html': 'i-lucide-file-code',
      'xml': 'i-lucide-file-code',
      'py': 'i-lucide-file-type',
      'go': 'i-lucide-file-type',
      'rs': 'i-lucide-file-type',
      'java': 'i-lucide-file-type',
      'kt': 'i-lucide-file-type',
      'swift': 'i-lucide-file-type',
      'c': 'i-lucide-file-type',
      'cpp': 'i-lucide-file-type',
      'h': 'i-lucide-file-type',
      'rb': 'i-lucide-file-type',
      'php': 'i-lucide-file-type',
      'sql': 'i-lucide-database',
      'yaml': 'i-lucide-file-cog',
      'yml': 'i-lucide-file-cog',
      'toml': 'i-lucide-file-cog',
      'ini': 'i-lucide-file-cog',
      'cfg': 'i-lucide-file-cog',
      'conf': 'i-lucide-file-cog',
      'sh': 'i-lucide-file-code',
      'bash': 'i-lucide-file-code',
      'zsh': 'i-lucide-file-code',
      'bat': 'i-lucide-file-code',
      'ps1': 'i-lucide-file-code',
      'lock': 'i-lucide-lock',
      'png': 'i-lucide-image',
      'jpg': 'i-lucide-image',
      'jpeg': 'i-lucide-image',
      'gif': 'i-lucide-image',
      'svg': 'i-lucide-image',
      'ico': 'i-lucide-image',
      'webp': 'i-lucide-image',
      'woff': 'i-lucide-file-type',
      'woff2': 'i-lucide-file-type',
      'ttf': 'i-lucide-file-type',
      'eot': 'i-lucide-file-type',
    }
    return extIcons[ext] || 'i-lucide-file'
  }

  return {
    // State
    treeData: readonly(treeData),
    expandedPaths,
    selectedFile,
    loading: readonly(loading),
    branches: readonly(branches),
    selectedBranch,
    commentCounts: readonly(commentCounts),
    directoryCommentCounts,
    flatTree,

    // Methods
    loadTree,
    loadCommentCounts,
    toggleFolder,
    selectFile,
    changeBranch,
    getFileIcon,
  }
}
