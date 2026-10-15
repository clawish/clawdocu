// Forge adapter — lets every server route talk to GitHub OR Gitee through
// one helper. Gitee API v5 mirrors the GitHub shapes we use (contents GET/PUT,
// git trees, refs, branches), so routes only vary in base URL + auth.
//
// Auth notes:
// - GitHub: Bearer token header (classic PAT).
// - Gitee: personal access token — most reliable as `access_token` query param
//   (documented for v5); we append it to every request. Bearer header also
//   sent for good measure.

type ForgeSource = 'github' | 'gitee'

export interface ForgeConfig {
  source: ForgeSource
  apiBase: string
  headers: Record<string, string>
  accessToken?: string
}

export function getForgeConfig(source?: string | null): ForgeConfig {
  const config = useRuntimeConfig()

  if (source === 'gitee') {
    const token = config.giteeToken || process.env.GITEE_TOKEN
    if (!token) {
      throw createError({ statusCode: 500, message: 'GITEE_TOKEN not configured' })
    }
    return {
      source: 'gitee',
      apiBase: 'https://gitee.com/api/v5',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      accessToken: token,
    }
  }

  const token = config.githubToken || process.env.GITHUB_TOKEN
  if (!token) {
    throw createError({ statusCode: 500, message: 'GITHUB_TOKEN not configured' })
  }
  return {
    source: 'github',
    apiBase: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  }
}

// Forge config for a project row (projects.source, default 'github')
export function projectForge(proj: { source?: string | null }): ForgeConfig {
  return getForgeConfig(proj.source)
}

// fetch() wrapper: pass an API path starting with '/' (e.g. '/repos/o/r/contents/x?ref=main').
// Handles base URL, auth headers, and Gitee's access_token query param.
export async function forgeFetch(
  proj: { source?: string | null },
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const forge = projectForge(proj)

  let url = `${forge.apiBase}${path}`
  if (forge.source === 'gitee' && forge.accessToken) {
    const sep = url.includes('?') ? '&' : '?'
    url += `${sep}access_token=${encodeURIComponent(forge.accessToken)}`
  }

  return fetch(url, {
    ...init,
    headers: {
      ...forge.headers,
      ...(init.headers as Record<string, string> | undefined),
    },
  })
}

function decodeBase64Text(b64: string): string {
  return Buffer.from(b64, 'base64').toString('utf-8')
}

/**
 * Locate a file's blob sha via the git trees API — works for dot-directories
 * and any contents-API quirk on both forges (Gitee returns 200 `{}` for some
 * contents lookups; the trees API always lists real paths).
 */
async function findBlobShaViaTree(
  proj: { source?: string | null },
  owner: string,
  repo: string,
  filePath: string,
  branch: string,
): Promise<string | null> {
  try {
    const res = await forgeFetch(proj, `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`)
    if (!res.ok) return null
    const data: any = await res.json().catch(() => null)
    if (!data || !Array.isArray(data.tree)) return null
    if (data.truncated) console.warn(`[forge] tree listing truncated for ${owner}/${repo}@${branch} — sha lookup may miss`)
    const entry = data.tree.find((e: any) => e?.type === 'blob' && e?.path === filePath)
    return entry?.sha ? String(entry.sha) : null
  } catch {
    return null
  }
}

/** Fetch a blob's base64 text by sha via the git blobs API (both forges). */
async function fetchBlobText(
  proj: { source?: string | null },
  owner: string,
  repo: string,
  sha: string,
): Promise<string | null> {
  try {
    const res = await forgeFetch(proj, `/repos/${owner}/${repo}/git/blobs/${sha}`)
    if (!res.ok) return null
    const blob: any = await res.json().catch(() => null)
    if (blob && typeof blob.content === 'string' && blob.content.length > 0) {
      return decodeBase64Text(blob.content)
    }
    return null
  } catch {
    return null
  }
}

/**
 * Fetch a text file's content + sha from the forge (GitHub or Gitee).
 *
 * Gitee's contents API does not always include usable data where GitHub does
 * (observed in prod: HTTP 200 with body `{}` — no content, no sha, no git_url).
 * Fallback chain: inline content → blob by contents-sha → blob via trees API.
 * Returns null when the file doesn't exist or the shape is unknown — callers
 * must treat null as "no file", never crash.
 */
export async function fetchForgeTextFile(
  proj: { source?: string | null },
  owner: string,
  repo: string,
  filePath: string,
  branch: string,
): Promise<{ sha: string; text: string } | null> {
  const res = await forgeFetch(
    proj,
    `/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
  )
  if (!res.ok) return null

  const data: any = await res.json().catch(() => null)
  if (data && typeof data === 'object') {
    if (typeof data.content === 'string' && data.content.length > 0) {
      return { sha: String(data.sha || ''), text: decodeBase64Text(data.content) }
    }
    // Contents shape without inline content (Gitee `{}`, or >1MB files):
    // try the blob it names, then the trees API.
    if (typeof data.sha === 'string' && data.sha) {
      const text = await fetchBlobText(proj, owner, repo, data.sha)
      if (text !== null) return { sha: data.sha, text }
    }
  }

  const treeSha = await findBlobShaViaTree(proj, owner, repo, filePath, branch)
  if (treeSha) {
    const text = await fetchBlobText(proj, owner, repo, treeSha)
    if (text !== null) return { sha: treeSha, text }
  }

  // Unknown shape — log it once so the next occurrence is diagnosable.
  console.warn(
    `[forge] ${proj.source || 'github'} could not read ${filePath} on ${branch}` +
      (data && typeof data === 'object' ? ` (contents keys: ${JSON.stringify(Object.keys(data))}, status ${res.status})` : ` (status ${res.status})`),
  )
  return null
}

/**
 * Get a file's blob sha (for conditional PUTs). Contents API first, trees API
 * as fallback — Gitee's `{}` responses carry no sha, and syncing without the
 * real sha makes Gitee reject the PUT ("sha is missing"/"sha is empty").
 */
export async function fetchForgeFileSha(
  proj: { source?: string | null },
  owner: string,
  repo: string,
  filePath: string,
  branch: string,
): Promise<string | null> {
  try {
    const res = await forgeFetch(
      proj,
      `/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
    )
    if (res.ok) {
      const data: any = await res.json().catch(() => null)
      if (data && typeof data === 'object' && typeof data.sha === 'string' && data.sha) {
        return data.sha
      }
    }
  } catch {
    // fall through to trees API
  }
  return findBlobShaViaTree(proj, owner, repo, filePath, branch)
}
