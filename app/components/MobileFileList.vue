<script setup lang="ts">
import type { TreeItem } from '~/composables/useFileTree'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  'selectFile': [item: TreeItem]
}>()

const {
  flatTree,
  expandedPaths,
  selectedFile,
  loading,
  branches,
  selectedBranch,
  commentCounts,
  directoryCommentCounts,
  toggleFolder,
  selectFile,
  changeBranch,
  getFileIcon,
  getVisibleCommentCount
} = useFileTree()

const handleBranchChange = async () => {
  await changeBranch(props.projectId, selectedBranch.value)
}

const handleSelectFile = (item: TreeItem) => {
  if (item.type === 'file') {
    selectFile(item)
    emit('selectFile', item)
  } else {
    toggleFolder(item.path)
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Branch Selector -->
    <div class="px-4 py-3 border-b border-gray-100">
      <label class="text-xs font-medium text-gray-500 mb-1 block">Branch</label>
      <select 
        v-model="selectedBranch" 
        @change="handleBranchChange"
        class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        <option v-for="branch in branches" :key="branch" :value="branch">{{ branch }}</option>
      </select>
    </div>
    
    <!-- File List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="text-gray-400 text-sm p-4 text-center">Loading...</div>
      <div v-else-if="flatTree.length === 0" class="text-gray-400 text-sm p-4 text-center">No files found</div>
      <div v-else class="divide-y divide-gray-100">
        <button
          v-for="item in flatTree"
          :key="item.path"
          @click="handleSelectFile(item)"
          class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          :class="selectedFile?.path === item.path ? 'bg-red-50' : ''"
        >
          <Icon 
            :name="item.type === 'dir' 
              ? (expandedPaths.has(item.path) ? 'i-lucide-folder-open' : 'i-lucide-folder')
              : getFileIcon(item.name)" 
            class="w-5 h-5 shrink-0"
            :class="item.type === 'dir' ? 'text-amber-500' : 'text-gray-400'"
          />
          <span 
            class="flex-1 text-left truncate"
            :class="selectedFile?.path === item.path ? 'text-red-600 font-medium' : 'text-gray-700'"
            :style="{ paddingLeft: item.depth * 16 + 'px' }"
          >
            {{ item.name }}
          </span>
          
          <!-- Comment count badge -->
          <span 
            v-if="getVisibleCommentCount(item)" 
            class="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full min-w-[24px] text-center"
          >
            {{ getVisibleCommentCount(item) }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>