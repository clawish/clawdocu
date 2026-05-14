import { computed, onUnmounted } from 'vue'
import { useLinePositionsState } from './useData'

/**
 * Composable for line position operations.
 * 
 * State is defined in useData.ts following the project pattern.
 * 
 * Features:
 * - Stores positions of all lines with data-source-line attributes
 * - Interpolates positions for empty/missing lines
 * - Auto-updates on resize
 * - Provides fast O(1) lookups
 */

/**
 * Composable for line position operations
 */
export function useLinePositions() {
  const state = useLinePositionsState()
  
  // Computed sorted line numbers
  const sortedLineNumbers = computed(() => {
    return Array.from(state.value.lineElementsMap.keys()).sort((a, b) => a - b)
  })
  
  /**
   * Scan DOM and build line element map
   */
  function scanLineElements() {
    if (!state.value.containerEl) {
      console.log('[useLinePositions] scanLineElements: no containerEl')
      return
    }
    
    const elements = state.value.containerEl.querySelectorAll('[data-source-line]')
    console.log('[useLinePositions] scanLineElements: found', elements.length, 'elements with data-source-line')
    
    const newMap = new Map<number, HTMLElement>()
    
    elements.forEach((el) => {
      const lineNum = parseInt((el as HTMLElement).getAttribute('data-source-line') || '0', 10) + 1
      if (lineNum > 0) {
        newMap.set(lineNum, el as HTMLElement)
      }
    })
    
    console.log('[useLinePositions] scanLineElements: map size', newMap.size, 'first 5 lines:', Array.from(newMap.keys()).slice(0, 5))
    
    state.value.lineElementsMap = newMap
    state.value.updateCount++  // Trigger reactivity (Map replacement doesn't auto-trigger)
  }
  
  /**
   * Get position for a line number
   * - If line exists: return its position
   * - If line doesn't exist: interpolate between nearest lines
   * - If no lines: return null
   */
  function getLinePosition(lineNumber: number): number | null {
    if (!state.value.scrollContainerEl) {
      console.log('[useLinePositions] getLinePosition: no scrollContainerEl')
      return null
    }
    
    const containerRect = state.value.scrollContainerEl.getBoundingClientRect()
    
    // Exact match
    const el = state.value.lineElementsMap.get(lineNumber)
    if (el) {
      const rect = el.getBoundingClientRect()
      const top = rect.top - containerRect.top + state.value.scrollContainerEl.scrollTop
      console.log('[useLinePositions] getLinePosition: line', lineNumber, 'found at top', top)
      return top
    }
    
    // Line doesn't exist - interpolate
    const sorted = sortedLineNumbers.value
    console.log('[useLinePositions] getLinePosition: line', lineNumber, 'not found, interpolating. Total lines:', sorted.length)
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
      const prevEl = state.value.lineElementsMap.get(prevLine)
      const nextEl = state.value.lineElementsMap.get(nextLine)
      
      if (prevEl && nextEl) {
        const prevRect = prevEl.getBoundingClientRect()
        const nextRect = nextEl.getBoundingClientRect()
        
        const prevTop = prevRect.top - containerRect.top + state.value.scrollContainerEl.scrollTop
        const nextTop = nextRect.top - containerRect.top + state.value.scrollContainerEl.scrollTop
        
        // Linear interpolation based on line number ratio
        const ratio = (lineNumber - prevLine) / (nextLine - prevLine)
        return prevTop + ratio * (nextTop - prevTop)
      }
    } else if (prevLine > 0) {
      // Line is after all existing lines - extrapolate from last line
      const prevEl = state.value.lineElementsMap.get(prevLine)
      if (prevEl) {
        const prevRect = prevEl.getBoundingClientRect()
        const prevTop = prevRect.top - containerRect.top + state.value.scrollContainerEl.scrollTop
        
        const avgLineHeight = getAverageLineHeight()
        return prevTop + (lineNumber - prevLine) * avgLineHeight
      }
    } else if (nextLine > 0) {
      // Line is before all existing lines - extrapolate from first line
      const nextEl = state.value.lineElementsMap.get(nextLine)
      if (nextEl) {
        const nextRect = nextEl.getBoundingClientRect()
        const nextTop = nextRect.top - containerRect.top + state.value.scrollContainerEl.scrollTop
        
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
      const currentEl = state.value.lineElementsMap.get(sorted[i])
      const nextEl = state.value.lineElementsMap.get(sorted[i + 1])
      
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
    if (!state.value.containerEl) return
    
    // Cleanup existing observer
    if (state.value.resizeObserver) {
      state.value.resizeObserver.disconnect()
    }
    
    state.value.resizeObserver = new ResizeObserver(() => {
      scanLineElements()
    })
    
    state.value.resizeObserver.observe(state.value.containerEl)
  }
  
  /**
   * Initialize the composable
   */
  async function initialize(container: HTMLElement, scrollContainer: HTMLElement) {
    console.log('[useLinePositions] initialize: container', container, 'scrollContainer', scrollContainer)
    state.value.containerEl = container
    state.value.scrollContainerEl = scrollContainer
    
    await nextTick()
    scanLineElements()
    setupResizeObserver()
    console.log('[useLinePositions] initialize: done, updateCount', state.value.updateCount)
  }
  
  /**
   * Cleanup
   */
  function cleanup() {
    if (state.value.resizeObserver) {
      state.value.resizeObserver.disconnect()
      state.value.resizeObserver = null
    }
    state.value.lineElementsMap.clear()
    state.value.containerEl = null
    state.value.scrollContainerEl = null
    state.value.updateCount = 0
  }
  
  // Auto-cleanup on unmount
  onUnmounted(cleanup)
  
  return {
    // State
    lineElements: computed(() => state.value.lineElementsMap),
    sortedLineNumbers,
    updateCount: computed(() => state.value.updateCount),
    
    // Methods
    initialize,
    scanLineElements,
    getLinePosition,
    getNearestLine,
    getTotalLines,
    getAverageLineHeight,
    cleanup,
  }
}
