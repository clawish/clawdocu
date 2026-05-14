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
   * Pre-computes positions for ALL lines (including empty ones via interpolation)
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
    const actualLines = new Map<number, number>()
    
    elements.forEach((el) => {
      const lineNum = parseInt((el as HTMLElement).getAttribute('data-source-line') || '0', 10) + 1
      if (lineNum > 0) {
        const elRect = el.getBoundingClientRect()
        const topPosition = elRect.top - containerRect.top + scrollTop
        actualLines.set(lineNum, topPosition)
      }
    })
    
    const sortedActual = Array.from(actualLines.keys()).sort((a, b) => a - b)
    console.log('[useLinePositions] scanLineElements: actual lines:', sortedActual.length, sortedActual.join(', '))
    
    // Show actual line positions
    console.log('[useLinePositions] scanLineElements: actual positions:', 
      sortedActual.map(l => `${l}:${Math.round(actualLines.get(l)!)}`).join(', '))
    
    // Get total lines (last line number + some buffer for trailing empty lines)
    const lastActualLine = sortedActual.length > 0 ? sortedActual[sortedActual.length - 1] : 0
    const totalLines = lastActualLine + 10 // Buffer for trailing empty lines
    
    // Pre-compute positions for ALL lines (interpolate missing ones)
    const allLines = new Map<number, number>()
    
    for (let lineNum = 1; lineNum <= totalLines; lineNum++) {
      if (actualLines.has(lineNum)) {
        // Actual line - use exact position
        allLines.set(lineNum, actualLines.get(lineNum)!)
      } else {
        // Empty line - interpolate
        const interpolatedPos = interpolatePosition(lineNum, actualLines, sortedActual)
        allLines.set(lineNum, interpolatedPos)
      }
    }
    
    console.log('[useLinePositions] scanLineElements: total lines:', allLines.size)
    console.log('[useLinePositions] scanLineElements: sample positions:', 
      'line 1:', Math.round(allLines.get(1)!),
      'line 56:', Math.round(allLines.get(56)!),
      'line 80:', Math.round(allLines.get(80)!),
      'line 99:', Math.round(allLines.get(99)!))
    
    state.value.linePositionsMap = allLines
    state.value.updateCount++
  }
  
  /**
   * Interpolate position for a missing line
   */
  function interpolatePosition(
    lineNum: number,
    actualLines: Map<number, number>,
    sortedActual: number[]
  ): number {
    if (sortedActual.length === 0) return 0
    
    // Find surrounding lines
    let prevLine = 0
    let prevPos = 0
    let nextLine = 0
    let nextPos = 0
    
    for (const line of sortedActual) {
      const pos = actualLines.get(line)!
      if (line < lineNum) {
        prevLine = line
        prevPos = pos
      } else if (line > lineNum) {
        nextLine = line
        nextPos = pos
        break
      }
    }
    
    // Interpolate
    if (prevLine > 0 && nextLine > 0) {
      // Between two actual lines
      const ratio = (lineNum - prevLine) / (nextLine - prevLine)
      return prevPos + ratio * (nextPos - prevPos)
    } else if (prevLine > 0) {
      // After all actual lines - extrapolate
      const avgHeight = getAverageLineHeightFromMap(actualLines, sortedActual)
      return prevPos + (lineNum - prevLine) * avgHeight
    } else if (nextLine > 0) {
      // Before all actual lines - extrapolate
      const avgHeight = getAverageLineHeightFromMap(actualLines, sortedActual)
      return nextPos - (nextLine - lineNum) * avgHeight
    }
    
    return 0
  }
  
  /**
   * Calculate average line height from actual lines map
   */
  function getAverageLineHeightFromMap(
    actualLines: Map<number, number>,
    sortedActual: number[]
  ): number {
    if (sortedActual.length < 2) return 24
    
    let totalHeight = 0
    let count = 0
    
    for (let i = 0; i < sortedActual.length - 1 && count < 5; i++) {
      const currentPos = actualLines.get(sortedActual[i])!
      const nextPos = actualLines.get(sortedActual[i + 1])!
      const lineDiff = sortedActual[i + 1] - sortedActual[i]
      
      if (lineDiff > 0) {
        totalHeight += (nextPos - currentPos) / lineDiff
        count++
      }
    }
    
    return count > 0 ? totalHeight / count : 24
  }
  
  /**
   * Get position for a line number
   * All lines are pre-computed, so this is a simple O(1) lookup
   */
  function getLinePosition(lineNumber: number): number | null {
    const position = state.value.linePositionsMap.get(lineNumber)
    if (position !== undefined) {
      console.log('[useLinePositions] getLinePosition: line', lineNumber, '=>', Math.round(position))
      return position
    }
    console.log('[useLinePositions] getLinePosition: line', lineNumber, 'not found in map')
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
