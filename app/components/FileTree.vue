<script setup lang="ts">
import type { TreeItem } from '~/composables/useFileTree'

const props = defineProps<{
  projectId: string
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  'update:sidebarOpen': [value: boolean]
  'selectFile': [item: TreeItem]
  'showFileMenu': [event: MouseEvent, item: TreeItem]
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
  getFileIcon
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
  <aside 
    v-if="sidebarOpen"
    class="w-64 shrink-0 border-r border-gray-200 bg-white overflow-y-auto"
  >
    <div class="p-4">
      <!-- Branch Selector -->
      <div class="mb-4">
        <label class="text-xs font-semibold text-gray-500 uppercase mb-1 block">Branch</label>
        <select 
          v-model="selectedBranch" 
          @change="handleBranchChange"
          class="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option v-for="branch in branches" :key="branch" :value="branch">{{ branch }}</option>
        </select>
      </div>
      
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-xs font-semibold text-gray-500 uppercase">Files</h2>
        <button 
          @click="emit('update:sidebarOpen', false)"
          class="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <Icon name="i-lucide-panel-left-close" class="w-4 h-4" />
        </button>
      </div>
    
      <div v-if="loading" class="text-gray-400 text-sm p-2">Loading...</div>
      <div v-else class="space-y-0.5">
        <div
          v-for="item in flatTree"
          :key="item.path"
          class="flex items-center gap-1"
          :style="{ paddingLeft: (item.depth * 12 + 8) + 'px' }"
        >
          <button
            @click="handleSelectFile(item)"
            @contextmenu.prevent="emit('showFileMenu', $event, item)"
            class="flex-1 flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-gray-100 transition-colors"
            :class="selectedFile?.path === item.path ? 'bg-red-50 text-red-600' : 'text-gray-700'"
          >
            <Icon 
              :name="item.type === 'dir' 
                ? (expandedPaths.has(item.path) ? 'i-lucide-folder-open' : 'i-lucide-folder')
                : getFileIcon(item.name)" 
              class="w-4 h-4"
            />
            <span class="truncate">{{ item.name }}</span>
          </button>
          
          <!-- Comment count badge -->
          <span 
            v-if="(item.type === 'file' && commentCounts[item.path]) || (item.type === 'dir' && directoryCommentCounts[item.path])" 
            class="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
          >
            {{ item.type === 'file' ? commentCounts[item.path] : directoryCommentCounts[item.path] }}
          </span>
        </div>
      </div>
    </div>
  </aside>

  <!-- Toggle sidebar button when closed -->
  <button 
    v-if="!sidebarOpen"
    @click="emit('update:sidebarOpen', true)"
    class="w-10 shrink-0 border-r border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50"
  >
    <Icon name="i-lucide-panel-left-open" class="w-5 h-5 text-gray-400" />
  </button>
</template>
