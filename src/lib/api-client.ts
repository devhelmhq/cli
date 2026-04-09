export interface ApiClientOptions {
  baseUrl: string
  token: string
  orgId?: string
  verbose?: boolean
}

export interface ApiError {
  status: number
  message: string
  details?: unknown
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface CursorPage<T> {
  content: T[]
  cursor?: string
  hasMore: boolean
}

export interface TableResponse<T> {
  content: T[]
}

export interface SingleResponse<T> {
  content: T
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string,
  ) {
    const parsed = ApiRequestError.parseBody(body)
    super(parsed)
    this.name = 'ApiRequestError'
  }

  private static parseBody(body: string): string {
    try {
      const json = JSON.parse(body)
      return json.message || json.error || body
    } catch {
      return body || 'Unknown API error'
    }
  }
}

export class ApiClient {
  private baseUrl: string
  private token: string
  private orgId: string
  private verbose: boolean

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.token = options.token
    this.orgId = options.orgId ?? '1'
    this.verbose = options.verbose ?? false
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'x-phelm-org-id': this.orgId,
      'x-phelm-workspace-id': '1',
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`

    if (this.verbose) {
      process.stderr.write(`${method} ${url}\n`)
    }

    const response = await fetch(url, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new ApiRequestError(response.status, response.statusText, text)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, body)
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  async delete(path: string): Promise<void> {
    return this.request<void>('DELETE', path)
  }

  async fetchAllPages<T>(basePath: string, pageSize = 50): Promise<T[]> {
    const all: T[] = []
    let page = 0
    let totalPages = 1

    while (page < totalPages) {
      const sep = basePath.includes('?') ? '&' : '?'
      const resp = await this.get<PageResponse<T>>(`${basePath}${sep}page=${page}&size=${pageSize}`)
      all.push(...resp.content)
      totalPages = resp.totalPages
      page++
    }

    return all
  }
}
