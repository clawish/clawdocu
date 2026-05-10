<script setup lang="ts">
const props = defineProps<{
  selectedText: string
  top: number
}>()

const emit = defineEmits<{
  save: []
  cancel: []
}>()

const commentText = defineModel<string>('commentText', { default: '' })
</script>

<template>
  <div 
    class="absolute bg-white border-2 border-red-500 rounded-lg shadow-lg p-3 z-50"
    :style="{ top: top + 'px', left: '16px', right: '16px' }"
  >
    <div class="text-xs text-gray-500 mb-2 p-2 bg-gray-50 rounded border-l-2 border-red-500 max-h-20 overflow-y-auto">
      "{{ selectedText }}"
    </div>
    <UTextarea 
      v-model="commentText"
      placeholder="Enter your comment..."
      :rows="3"
      class="block w-full"
    />
    <div class="flex gap-2 mt-2">
      <UButton @click="emit('save')" size="xs" label="Save" color="error" />
      <UButton @click="emit('cancel')" size="xs" variant="ghost" label="Cancel" />
    </div>
  </div>
</template>
