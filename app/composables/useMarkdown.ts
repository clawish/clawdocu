import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import injectLinenumbers from 'markdown-it-inject-linenumbers'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
      } catch (e) {}
    }
    return ''
  }
})

// Use the plugin to inject line numbers for block elements
md.use(injectLinenumbers)

// Override fence renderer to add line numbers to each line inside code blocks
const defaultFence = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options)
}

md.renderer.rules.fence = function(tokens, idx, options, env, self) {
  const token = tokens[idx]
  const info = token.info ? md.utils.unescapeAll(token.info).trim() : ''
  let langName = ''
  
  if (info) {
    langName = info.split(/\s+/g)[0]
  }
  
  const codeText = token.content
  
  // Highlight
  let highlighted = ''
  if (langName && hljs.getLanguage(langName)) {
    try {
      highlighted = hljs.highlight(codeText, { language: langName, ignoreIllegals: true }).value
    } catch (e) {}
  } else {
    highlighted = md.utils.escapeHtml(codeText)
  }
  
  // Get the starting line number from token.map
  const startLine = token.map ? token.map[0] + 1 : 1 // 1-indexed, +1 to skip ``` line
  
  // Wrap each line with data-source-line
  const lines = highlighted.split('\n')
  const wrappedLines = lines.map((line, idx) => {
    const lineNum = startLine + idx
    return `<span data-source-line="${lineNum - 1}">${line}</span>` // Plugin uses 0-indexed
  }).join('\n')
  
  return `<div class="code-block-wrapper relative" data-source-line="${token.map ? token.map[0] : 0}">
    <button 
      class="copy-btn absolute top-2 right-2 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded border border-gray-300"
      onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)"
    >
      Copy
    </button>
    <pre class="!mt-0 !mb-0"><code class="language-${langName || 'plaintext'} hljs">${wrappedLines}</code></pre>
  </div>\n`
}

export const useMarkdown = () => {
  const parse = (content: string): string => {
    return md.render(content)
  }
  
  return {
    parse,
  }
}