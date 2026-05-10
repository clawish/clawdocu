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

export const useMarkdown = () => {
  const parse = (content: string): string => {
    return marked(content) as string
  }
  
  return {
    parse,
  }
}
