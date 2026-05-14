import { ref, computed, watch, onUnmounted, nextTick } from 'vue'

/**
 * Composable for tracking line positions in file content.
 * 
 * - Stores positions of all lines with data-source-line attributes
 * - Interpolates positions for empty/missing lines
 * - Auto-updates on resize
 * - Provides fast O(1) lookups
 */

export function useLinePositions() {
  // Map of line number -> element
  const lineElements = ref<Map<number, HTMLElement>>(new Map())
  
  // Sorted list of line numbers (for interpolation)
  const sortedLineNumbers = computed(() => {
    return Array.from(lineElements.value.keys()).sort((a, b) => a - b)
  })
  
  // Container refs (set by component)
  const containerRef = ref<HTMLElement | null>(null)
  const scrollContainerRef = ref<HTMLElement | null>(null)
  
  // Resize observer for auto-updates
  let resizeObserver: ResizeObserver | null = null
  
  /**
   * Scan DOM and build line element map
   */
  function scanLineElements() {
    if (!containerRef.value) return
    
    const elements = containerRef.value.querySelectorAll('[data-source-line]')
    const newMap = new Map<number, HTMLElement>()
    
    elements.forEach((el) => {
      const lineNum = parseInt((el as HTMLElement).getAttribute('data-source-line') || '0', 10) + 1 // Convert 0-indexed to 1-indexed
      if (lineNum > 0) {
        newMap.set(lineNum, el as HTMLElement)
      }
    })
    
    lineElements.value = newMap
  }
  
  /**
   * Get position for a line number
   * - If line exists: return its position
   * - If line doesn't exist: interpolate between nearest lines
   * - If no lines: return null
   */
  function getLinePosition(lineNumber: number): number | null {
    if (!scrollContainerRef.value) return null
    
    const containerRect = scrollContainerRef.value.getBoundingClientRect()
    
    // Exact match
    const el = lineElements.value.get(lineNumber)
    if (el) {
      const rect = el.getBoundingClientRect()
      return rect.top - containerRect.top + scrollContainerRef.value.scrollTop
    }
    
    // Line doesn't exist - interpolate
    const sorted = sortedLineNumbers.value
    if (sorted.length === 0) return null
    
    // Find surrounding lines
    let prevLine = 0
    let nextLine = 0
    
    for (const line of sorted) {
      if (line < lineNumber) {
        prevLine = line
      } else if (line > lineNumber) {
        nextLine = line
        break
      }
    }
    
    // Interpolate position
    if (prevLine > 0 && nextLine > 0) {
      // Line is between two existing lines - interpolate
      const prevEl = lineElements.value.get(prevLine)
      const nextEl = lineElements.value.get(nextLine)
      
      if (prevEl && nextEl) {
        const prevRect = prevEl.getBoundingClientRect()
        const nextRect = nextEl.getBoundingClientRect()
        
        const prevTop = prevRect.top - containerRect.top + scrollContainerRef.value.scrollTop
        const nextTop = nextRect.top - containerRect.top + scrollContainerRef.value.scrollTop
        
        // Linear interpolation based on line number ratio
        const ratio = (lineNumber - prevLine) / (nextLine - prevLine)
        return prevTop + ratio * (nextTop - prevTop)
      }
    } else if (prevLine > 0) {
      // Line is after all existing lines - extrapolate from last line
      const prevEl = lineElements.value.get(prevLine)
      if (prevEl) {
        const prevRect = prevEl.getBoundingClientRect()
        const prevTop = prevRect.top - containerRect.top + scrollContainerRef.value.scrollTop
        
        // Assume standard line height (24px)
        const avgLineHeight = getAverageLineHeight()
        return prevTop + (lineNumber - prevLine) * avgLineHeight
      }
    } else if (nextLine > 0) {
      // Line is before all existing lines - extrapolate from first line
      const nextEl = lineElements.value.get(nextLine)
      if (nextEl) {
        const nextRect = nextEl.getBoundingClientRect()
        const nextTop = nextRect.top - containerRect.top + scrollContainerRef.value.scrollTop
        
        // Assume standard line height (24px)
        const avgLineHeight = getAverageLineHeight()
        return nextTop - (nextLine - lineNumber) * avgLineHeight
      }
    }
    
    return null
  }
  
  /**
   * Calculate average line height from existing lines
   */
  function getAverageLineHeight(): number {
    const sorted = sortedLineNumbers.value
    if (sorted.length < 2) return 24 // Default
    
    // Sample a few consecutive lines to get average height
    let totalHeight = 0
    let count = 0
    
    for (let i = 0; i < sorted.length - 1 && count < 5; i++) {
      const currentEl = lineElements.value.get(sorted[i])
      const nextEl = lineElements.value.get(sorted[i + 1])
      
      if (currentEl && nextEl) {
        const currentRect = currentEl.getBoundingClientRect()
        const nextRect = nextEl.getBoundingClientRect()
        const lineDiff = sorted[i + 1] - sorted[i]
        
        if (lineDiff > 0) {
          const height = (nextRect.top - currentRect.top) / lineDiff
          totalHeight += height
          count++
        }
      }
    }
    
    return count > 0 ? totalHeight / count : 24
  }
  
  /**
   * Get the nearest existing line at or after the target line
   */
  function getNearestLine(lineNumber: number): number | null {
    const sorted = sortedLineNumbers.value
    if (sorted.length === 0) return null
    
    for (const line of sorted) {
      if (line >= lineNumber) {
        return line
      }
    }
    
    // Return last line
    return sorted[sorted.length - 1] || null
  }
  
  /**
   * Get total line count (last line number with content)
   */
  function getTotalLines(): number {
    const sorted = sortedLineNumbers.value
    return sorted.length > 0 ? sorted[sorted.length - 1] : 0
  }
  
  /**
   * Setup resize observer for auto-updates
   */
  function setupResizeObserver() {
    if (!containerRef.value) return
    
    resizeObserver = new ResizeObserver(() => {
      // Debounce - only scan if size actually changed
      scanLineElements()
    })
    
    resizeObserver.observe(containerRef.value)
  }
  
  /**
   * Initialize the composable
   */
  async function initialize(container: HTMLElement, scrollContainer: HTMLElement) {
    containerRef.value = container
    scrollContainerRef.value = scrollContainer
    
    await nextTick()
    scanLineElements()
    setupResizeObserver()
  }
  
  /**
   * Cleanup
   */
  function cleanup() {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    lineElements.value.clear()
    containerRef.value = null
    scrollContainerRef.value = null
  }
  
  // Auto-cleanup on unmount
  onUnmounted(cleanup)
  
  return {
    // State
    lineElements,
    sortedLineNumbers,
    
    // Methods
    initialize,
    scanLineElements,
    getLinePosition,
    getNearestLine,
    getTotalLines,
    getAverageLineHeight,
    cleanup,
    
    // Refs to set
    containerRef,
    scrollContainerRef,
  }
}
