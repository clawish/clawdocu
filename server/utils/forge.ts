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
 * Fallback chain: inline content → blob by contents-sha → blob via trees API
 * (branch name, then commit sha). Returns null when the file doesn't exist or
 * the shape is unknown — callers must treat null as "no file", never crash.
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
 * Locate a file's blob sha via the git trees API, with two ref spellings:
 * 1. branch name directly (GitHub accepts this; Gitee usually wants a commit
 *    sha — a 404 just means "try the other way")
 * 2. resolve the branch to its commit sha first, then list that tree
 * Recursive so dot-directories are covered without a second call.
 */
async function findBlobShaViaTree(
  proj: { source?: string | null },
  owner: string,
  repo: string,
  filePath: string,
  branch: string,
): Promise<string | null> {
  const listTree = async (ref: string): Promise<any[] | null> => {
    try {
      const res = await forgeFetch(proj, `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`)
      if (!res.ok) return null
      const data: any = await res.json().catch(() => null)
      if (!data || !Array.isArray(data.tree)) return null
      if (data.truncated) console.warn(`[forge] tree listing truncated for ${owner}/${repo}@${ref} — sha lookup may miss`)
      return data.tree
    } catch {
      return null
    }
  }

  let tree = await listTree(branch)
  if (tree === null) {
    // Branch name rejected — resolve it to a commit sha and retry.
    try {
      const branchRes = await forgeFetch(proj, `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`)
      if (branchRes.ok) {
        const branchData: any = await branchRes.json().catch(() => null)
        const commitSha = branchData?.commit?.commit?.sha || branchData?.commit?.sha || null
        if (typeof commitSha === 'string' && commitSha) {
          tree = await listTree(commitSha)
        }
      }
    } catch {
      // keep tree = null
    }
  }

  if (!tree) return null
  const entry = tree.find((e: any) => e?.type === 'blob' && e?.path === filePath)
  return entry?.sha ? String(entry.sha) : null
}

/**
 * Locate a file's blob sha by listing its parent directory via the contents
 * API. Gitee returns `{}` for dot-FILE lookups, but a directory listing of
 * `.clawdocu-comments/` may still work — cheap to try before the trees API.
 */
async function findBlobShaViaDirListing(
  proj: { source?: string | null },
  owner: string,
  repo: string,
  filePath: string,
  branch: string,
): Promise<string | null> {
  const dir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : ''
  if (!dir) return null
  try {
    const res = await forgeFetch(proj, `/repos/${owner}/${repo}/contents/${dir}?ref=${encodeURIComponent(branch)}`)
    if (!res.ok) return null
    const data: any = await res.json().catch(() => null)
    if (!Array.isArray(data)) return null
    const entry = data.find((e: any) => e?.type === 'file' && e?.path === filePath)
    return entry?.sha ? String(entry.sha) : null
  } catch {
    return null
  }
}

/**
 * Get a file's blob sha (for conditional PUTs), exhausting every source:
 * 1. contents API inline sha (GitHub's normal shape)
 * 2. parent-directory listing (Gitee lies about dot-files but may list the dir)
 * 3. git trees API — branch name first, then commit sha
 * Gitee's `{}` responses carry no sha, and syncing without the real sha gets
 * the PUT rejected ("sha is missing"/"sha is empty").
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
    // fall through to the next source
  }

  const dirSha = await findBlobShaViaDirListing(proj, owner, repo, filePath, branch)
  if (dirSha) return dirSha

  return findBlobShaViaTree(proj, owner, repo, filePath, branch)
}

/**
 * Create or update a text file on the forge. GitHub's contents API unifies
 * both under PUT (sha only for updates); Gitee v5 splits the verbs — PUT with
 * sha for update, POST for creation — and rejects PUT-without-sha ("sha is
 * missing"). Strategy: PUT with the resolved sha if we have one; if the PUT
 * is rejected AND we had no sha (file shouldn't exist), retry once as POST.
 */
export async function putForgeFile(
  proj: { source?: string | null },
  owner: string,
  repo: string,
  filePath: string,
  branch: string,
  contentB64: string,
  message: string,
  sha?: string | null,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const doPut = () =>
    forgeFetch(proj, `/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: contentB64, branch, ...(sha ? { sha } : {}) }),
    })

  let res = await doPut()
  if (res.ok) return { ok: true, status: res.status }

  const errText = await res.text().catch(() => '')
  const shaRejected = !sha && /sha/i.test(errText)

  if (shaRejected) {
    // Gitee create-file semantics: try POST without sha.
    const postRes = await forgeFetch(proj, `/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: contentB64, branch }),
    })
    if (postRes.ok) return { ok: true, status: postRes.status }
    const postErr = await postRes.text().catch(() => '')
    return { ok: false, status: postRes.status, error: postErr || `POST ${postRes.status}` }
  }

  return { ok: false, status: res.status, error: errText || `PUT ${res.status}` }
}
