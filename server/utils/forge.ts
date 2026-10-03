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
