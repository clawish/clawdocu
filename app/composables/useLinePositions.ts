import { computed, onUnmounted } from 'vue'
import { useLinePositionsState } from './useData'

/**
 * Composable for line position operations.
 * 
 * State is defined in useData.ts following the project pattern.
 * 
 * Stores line positions as { lineNumber: scrollTopPosition } for:
 * - Simple O(1) lookups
 * - Easy interpolation for missing lines
 * - No DOM queries during positioning
 * 
 * Positions are relative to scroll container (scrollTop), so they
 * don't change when scrolling - only the viewport moves.
 */

/**
 * Composable for line position operations
 */
export function useLinePositions() {
  const state = useLinePositionsState()
  
  // Computed sorted line numbers
  const sortedLineNumbers = computed(() => {
    return Array.from(state.value.linePositionsMap.keys()).sort((a, b) => a - b)
  })
  
  /**
   * Scan DOM and build line position map
   * Stores { lineNumber: scrollTopPosition } for each line
   */
  function scanLineElements() {
    if (!state.value.containerEl || !state.value.scrollContainerEl) {
      console.log('[useLinePositions] scanLineElements: no container refs')
      return
    }
    
    const elements = state.value.containerEl.querySelectorAll('[data-source-line]')
    console.log('[useLinePositions] scanLineElements: found', elements.length, 'elements with data-source-line')
    
    const containerRect = state.value.scrollContainerEl.getBoundingClientRect()
    const scrollTop = state.value.scrollContainerEl.scrollTop
    const newMap = new Map<number, number>()
    
    elements.forEach((el) => {
      const lineNum = parseInt((el as HTMLElement).getAttribute('data-source-line') || '0', 10) + 1
      if (lineNum > 0) {
        const elRect = el.getBoundingClientRect()
        const topPosition = elRect.top - containerRect.top + scrollTop
        newMap.set(lineNum, topPosition)
      }
    })
    
    const sortedLines = Array.from(newMap.keys()).sort((a, b) => a - b)
    console.log('[useLinePositions] scanLineElements: map size', newMap.size)
    console.log('[useLinePositions] scanLineElements: all lines:', sortedLines.join(', '))
    console.log('[useLinePositions] scanLineElements: positions:', sortedLines.map(l => `${l}:${Math.round(newMap.get(l)!)}`).join(', '))
    
    state.value.linePositionsMap = newMap
    state.value.updateCount++
  }
  
  /**
   * Get position for a line number
   * - If line exists: return its position
   * - If line doesn't exist: interpolate between nearest lines
   * - If no lines: return null
   */
  function getLinePosition(lineNumber: number): number | null {
    // Exact match
    const position = state.value.linePositionsMap.get(lineNumber)
    if (position !== undefined) {
      console.log('[useLinePositions] getLinePosition: line', lineNumber, 'found at', position)
      return position
    }
    
    // Line doesn't exist - interpolate
    const sorted = sortedLineNumbers.value
    console.log('[useLinePositions] getLinePosition: line', lineNumber, 'not found, interpolating. Total lines:', sorted.length)
    if (sorted.length === 0) return null
    
    // Find surrounding lines
    let prevLine = 0
    let prevPosition = 0
    let nextLine = 0
    let nextPosition = 0
    
    for (const line of sorted) {
      const linePos = state.value.linePositionsMap.get(line)!
      if (line < lineNumber) {
        prevLine = line
        prevPosition = linePos
      } else if (line > lineNumber) {
        nextLine = line
        nextPosition = linePos
        break
      }
    }
    
    console.log('[useLinePositions] getLinePosition: line', lineNumber, 'prevLine:', prevLine, 'nextLine:', nextLine)
    
    // Interpolate position
    if (prevLine > 0 && nextLine > 0) {
      // Line is between two existing lines - interpolate
      const ratio = (lineNumber - prevLine) / (nextLine - prevLine)
      const interpolatedPosition = prevPosition + ratio * (nextPosition - prevPosition)
      console.log('[useLinePositions] getLinePosition: line', lineNumber, 'interpolated between', prevLine, '@', prevPosition, 'and', nextLine, '@', nextPosition, '=>', interpolatedPosition)
      return interpolatedPosition
    } else if (prevLine > 0) {
      // Line is after all existing lines - extrapolate from last line
      const avgLineHeight = getAverageLineHeight()
      const extrapolatedPosition = prevPosition + (lineNumber - prevLine) * avgLineHeight
      console.log('[useLinePositions] getLinePosition: line', lineNumber, 'extrapolated from', prevLine, '@', prevPosition, 'avgHeight:', avgLineHeight, '=>', extrapolatedPosition)
      return extrapolatedPosition
    } else if (nextLine > 0) {
      // Line is before all existing lines - extrapolate from first line
      const avgLineHeight = getAverageLineHeight()
      const extrapolatedPosition = nextPosition - (nextLine - lineNumber) * avgLineHeight
      console.log('[useLinePositions] getLinePosition: line', lineNumber, 'extrapolated before', nextLine, '@', nextPosition, 'avgHeight:', avgLineHeight, '=>', extrapolatedPosition)
      return extrapolatedPosition
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
      const currentPos = state.value.linePositionsMap.get(sorted[i])!
      const nextPos = state.value.linePositionsMap.get(sorted[i + 1])!
      const lineDiff = sorted[i + 1] - sorted[i]
      
      if (lineDiff > 0) {
        const height = (nextPos - currentPos) / lineDiff
        totalHeight += height
        count++
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
    state.value.linePositionsMap.clear()
    state.value.containerEl = null
    state.value.scrollContainerEl = null
    state.value.updateCount = 0
  }
  
  // Auto-cleanup on unmount
  onUnmounted(cleanup)
  
  return {
    // State
    linePositions: computed(() => state.value.linePositionsMap),
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
