// Global state management for ClawDocu
import type { Ref } from 'vue'

// ============================================
// Default Values
// ============================================

export const defaultTreeData: any[] = []
export const defaultExpandedPaths = new Set<string>()
export const defaultSelectedFile: { path: string; name: string; type: 'file' } | null = null
export const defaultBranches = ['main']
export const defaultBranch = ''
export const defaultCommentCounts: Record<string, number> = {}

export const defaultProjectState = {
  project: null as any,
  fileContent: '',
  loading: false,
  markdownMode: 'render' as 'render' | 'edit',
  sidebarOpen: true,
  syncing: false
}

export const defaultContextMenuState = {
  show: false,
  x: 0,
  y: 0,
  item: null as any
}

export const defaultUIState = {
  showToolbar: false,
  toolbarPosition: { top: 0, left: 0 },
  commentPositionsVersion: 0,
  selectedLineNumber: 1,
  currentCommentIndex: 0,
  contentHeight: 0,
  windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1024
}

// ============================================
// File Tree State Composables
// ============================================

export const useTreeDataState = () => useState<typeof defaultTreeData>('fileTreeData', () => [...defaultTreeData])
export const useExpandedPathsState = () => useState<typeof defaultExpandedPaths>('fileTreeExpandedPaths', () => new Set(defaultExpandedPaths))
export const useSelectedFileState = () => useState<typeof defaultSelectedFile>('fileTreeSelectedFile', () => defaultSelectedFile)
export const useBranchesState = () => useState<typeof defaultBranches>('fileTreeBranches', () => [...defaultBranches])
export const useSelectedBranchState = () => useState<typeof defaultBranch>('fileTreeSelectedBranch', () => defaultBranch)
export const useCommentCountsState = () => useState<typeof defaultCommentCounts>('fileTreeCommentCounts', () => ({ ...defaultCommentCounts }))
export const useTreeLoadingState = () => useState<boolean>('fileTreeLoading', () => true)

// ============================================
// Project State Composables
// ============================================

export const useProjectState = () => useState<typeof defaultProjectState>('projectState', () => ({ ...defaultProjectState }))

// ============================================
// UI State Composables
// ============================================

export const useContextMenuState = () => useState<typeof defaultContextMenuState>('contextMenuState', () => ({ ...defaultContextMenuState }))
export const useUIState = () => useState<typeof defaultUIState>('uiState', () => ({ ...defaultUIState }))

// ============================================
// Exports
// ============================================

export const stateComposables = {
  useTreeDataState,
  useExpandedPathsState,
  useSelectedFileState,
  useBranchesState,
  useSelectedBranchState,
  useCommentCountsState,
  useTreeLoadingState,
  useProjectState,
  useContextMenuState,
  useUIState
}

export const defaultValues = {
  defaultTreeData,
  defaultExpandedPaths,
  defaultSelectedFile,
  defaultBranches,
  defaultBranch,
  defaultCommentCounts,
  defaultProjectState,
  defaultContextMenuState,
  defaultUIState
}
