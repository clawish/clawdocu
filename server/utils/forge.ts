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

// Fetch an absolute API URL (e.g. a blob `git_url` returned by the contents
// API) with the project's forge auth. forgeFetch() only takes paths, so
// absolute URLs need their own wrapper (Gitee still needs the token param).
async function forgeFetchAbsolute(
  proj: { source?: string | null },
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const forge = projectForge(proj)
  let finalUrl = url
  if (forge.source === 'gitee' && forge.accessToken) {
    const sep = finalUrl.includes('?') ? '&' : '?'
    finalUrl += `${sep}access_token=${encodeURIComponent(forge.accessToken)}`
  }
  return fetch(finalUrl, {
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
 * Fetch a text file's content + sha from the forge (GitHub or Gitee).
 *
 * Gitee's contents API does not always include a usable `content` field where
 * GitHub does (observed: ERR_INVALID_ARG_TYPE from Buffer.from(undefined) in
 * prod). Fallback chain: data.content → data.git_url blob fetch → null.
 * Returns null when the file doesn't exist (non-ok) or the shape is unknown —
 * callers must treat null as "no file", never crash.
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
  if (!data || typeof data !== 'object') return null

  if (typeof data.content === 'string' && data.content.length > 0) {
    return { sha: String(data.sha || ''), text: decodeBase64Text(data.content) }
  }

  // No inline content (Gitee quirk / large file): fetch the blob it points to.
  if (typeof data.git_url === 'string' && data.git_url) {
    const blobRes = await forgeFetchAbsolute(proj, data.git_url)
    if (blobRes.ok) {
      const blob: any = await blobRes.json().catch(() => null)
      if (blob && typeof blob.content === 'string' && blob.content.length > 0) {
        return { sha: String(blob.sha || data.sha || ''), text: decodeBase64Text(blob.content) }
      }
    }
  }

  // Unknown shape — log it once so the next occurrence is diagnosable.
  console.warn(
    `[forge] ${proj.source || 'github'} contents response had no decodable content for ${filePath}`,
    { keys: Object.keys(data), encoding: data.encoding, size: data.size, status: res.status },
  )
  return null
}
