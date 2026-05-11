import { marked } from 'marked'
import hljs from 'highlight.js'

// Custom renderer for code blocks with copy button
const renderer = new marked.Renderer()

renderer.code = function({ text, lang }: { text: string; lang?: string }) {
  const escapedCode = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  const language = lang || 'plaintext'
  
  // Highlight with highlight.js if language is supported
  let highlightedCode = escapedCode
  if (lang && hljs.getLanguage(lang)) {
    try {
      highlightedCode = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
    } catch (e) {
      // Fall back to escaped code
    }
  }
  
  return `<div class="code-block-wrapper relative">
    <button 
      class="copy-btn absolute top-2 right-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded border border-gray-300"
      onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)"
    >
      Copy
    </button>
    <pre class="!mt-0 !mb-0"><code class="language-${language} hljs">${highlightedCode}</code></pre>
  </div>`
}

marked.setOptions({
  gfm: true,
  breaks: true,
  renderer,
})

/**
 * Add data-line attributes to markdown HTML output
 * Each line in the original markdown gets a data-line attribute
 */
function addLineAttributes(html: string, originalContent: string): string {
  const lines = originalContent.split('\n')
  let currentLine = 1
  let result = html
  
  // We need to track which HTML elements correspond to which source lines
  // This is tricky because markdown can produce multi-line HTML from single lines
  // Strategy: wrap each paragraph/list item/etc with data-line
  
  // For simplicity, we'll add data-line to specific elements:
  // - <p> tags (paragraphs)
  // - <h1>-<h6> tags (headers)
  // - <li> tags (list items)
  // - <pre> tags (code blocks - already handled)
  
  // Parse the HTML and add data-line attributes
  // We'll use a simple approach: track line numbers as we process
  
  // Actually, a better approach: use marked's lexer to get tokens with line info
  // Then render each token with data-line
  
  return result
}

export const useMarkdown = () => {
  const parse = (content: string): string => {
    // Split content into lines
    const lines = content.split('\n')
    
    // Process each line and track line numbers
    let htmlParts: string[] = []
    let currentLine = 1
    let inCodeBlock = false
    let codeBlockStartLine = 0
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Track code blocks (they span multiple lines)
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true
          codeBlockStartLine = currentLine
        } else {
          inCodeBlock = false
        }
        currentLine++
        continue
      }
      
      if (inCodeBlock) {
        currentLine++
        continue
      }
      
      // Skip empty lines but increment counter
      if (line.trim() === '') {
        currentLine++
        continue
      }
      
      // Parse the line and add data-line attribute
      const parsed = marked(line) as string
      
      // Wrap the parsed content with data-line
      // Only wrap if it produces actual content
      if (parsed.trim()) {
        // Check what kind of element was produced
        if (parsed.includes('<p>')) {
          // Paragraph - add data-line to the p tag
          htmlParts.push(parsed.replace('<p>', `<p data-line="${currentLine}">`))
        } else if (parsed.match(/<h[1-6]/)) {
          // Header - add data-line to the header tag
          htmlParts.push(parsed.replace(/<h([1-6])>/, `<h$1 data-line="${currentLine}">`))
        } else if (parsed.includes('<li>')) {
          // List item - add data-line to the li tag
          htmlParts.push(parsed.replace('<li>', `<li data-line="${currentLine}">`))
        } else {
          // Other content - wrap in a span with data-line
          htmlParts.push(`<span data-line="${currentLine}">${parsed}</span>`)
        }
      }
      
      currentLine++
    }
    
    // Now handle code blocks separately
    // Re-parse the full content to get proper code block rendering
    let fullHtml = marked(content) as string
    
    // Now we need to add data-line attributes to the full HTML
    // We'll use a different approach: parse the HTML and map back to source lines
    
    // Actually, let's use a simpler approach:
    // 1. Get all tokens from marked.lexer
    // 2. Render each token with its line number
    
    const tokens = marked.lexer(content)
    
    // Build HTML with data-line attributes
    let result = ''
    let lineNum = 1
    
    for (const token of tokens) {
      // @ts-ignore - marked tokens have line property
      const tokenLine = token.line || lineNum
      
      if (token.type === 'heading') {
        // @ts-ignore
        const depth = token.depth
        // @ts-ignore
        const text = token.text
        result += `<h${depth} data-line="${tokenLine}">${marked.parseInline(text) as string}</h${depth}>\n`
      } else if (token.type === 'paragraph') {
        // @ts-ignore
        const text = token.text
        result += `<p data-line="${tokenLine}">${marked.parseInline(text) as string}</p>\n`
      } else if (token.type === 'code') {
        // Code block - render normally (already has special handling)
        // @ts-ignore
        const lang = token.lang || ''
        // @ts-ignore
        const codeText = token.text
        
        const escapedCode = codeText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        
        let highlightedCode = escapedCode
        if (lang && hljs.getLanguage(lang)) {
          try {
            highlightedCode = hljs.highlight(codeText, { language: lang, ignoreIllegals: true }).value
          } catch (e) {}
        }
        
        result += `<div class="code-block-wrapper relative" data-line="${tokenLine}">
          <button 
            class="copy-btn absolute top-2 right-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded border border-gray-300"
            onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)"
          >
            Copy
          </button>
          <pre class="!mt-0 !mb-0"><code class="language-${lang || 'plaintext'} hljs">${highlightedCode}</code></pre>
        </div>\n`
      } else if (token.type === 'list') {
        // @ts-ignore
        const items = token.items
        // @ts-ignore
        const ordered = token.ordered
        
        const tag = ordered ? 'ol' : 'ul'
        result += `<${tag} data-line="${tokenLine}">\n`
        
        for (const item of items) {
          // @ts-ignore
          const itemLine = item.line || tokenLine
          // @ts-ignore
          const itemText = item.text
          result += `<li data-line="${itemLine}">${marked.parseInline(itemText) as string}</li>\n`
        }
        
        result += `</${tag}>\n`
      } else if (token.type === 'space') {
        // Skip
      } else {
        // Other tokens - render normally
        // @ts-ignore
        result += marked.Parser.parse([token]) as string
      }
      
      // Update line number based on token content
      // @ts-ignore
      if (token.raw) {
        // @ts-ignore
        lineNum += token.raw.split('\n').length - 1
      }
    }
    
    return result
  }
  
  return {
    parse,
  }
}