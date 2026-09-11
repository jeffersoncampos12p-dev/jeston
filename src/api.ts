export interface ApiRouteContract {
  params?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  response?: unknown;
  error?: unknown;
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
}

type RequestOptions<T extends ApiRouteContract> = {
  params?: T['params'];
  query?: T['query'];
  body?: T['body'];
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export class ApiClientError<TError = unknown> extends Error {
  constructor(public readonly status: number, public readonly details: TError, message = `API request failed with HTTP ${status}`) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function buildPath(path: string, params: Record<string, string | number> | undefined, query: Record<string, string | number | boolean | undefined> | undefined): string {
  const resolved = path.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined) throw new Error(`Missing API route parameter: ${name}`);
    return encodeURIComponent(String(value));
  });
  const url = new URL(resolved, 'http://ryvax.invalid');
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) url.searchParams.set(key, String(value));
  return `${url.pathname}${url.search}`;
}

export function createApiClient<Routes extends Record<string, ApiRouteContract>>(options: ApiClientOptions = {}) {
  const request = async <Path extends keyof Routes & string>(method: string, path: Path, requestOptions: RequestOptions<Routes[Path]> = {}): Promise<Routes[Path]['response']> => {
    const fetcher = options.fetch ?? globalThis.fetch;
    const url = `${options.baseUrl ?? ''}${buildPath(path, requestOptions.params, requestOptions.query)}`;
    const response = await fetcher(url, {
      method,
      headers: { accept: 'application/json', ...(requestOptions.body === undefined ? {} : { 'content-type': 'application/json' }), ...options.headers, ...requestOptions.headers },
      ...(requestOptions.body === undefined ? {} : { body: JSON.stringify(requestOptions.body) }),
      signal: requestOptions.signal
    });
    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) throw new ApiClientError(response.status, payload);
    return payload as Routes[Path]['response'];
  };
  return {
    request,
    get: <Path extends keyof Routes & string>(path: Path, requestOptions?: Omit<RequestOptions<Routes[Path]>, 'body'>) => request('GET', path, requestOptions),
    post: <Path extends keyof Routes & string>(path: Path, requestOptions?: RequestOptions<Routes[Path]>) => request('POST', path, requestOptions),
    put: <Path extends keyof Routes & string>(path: Path, requestOptions?: RequestOptions<Routes[Path]>) => request('PUT', path, requestOptions),
    patch: <Path extends keyof Routes & string>(path: Path, requestOptions?: RequestOptions<Routes[Path]>) => request('PATCH', path, requestOptions),
    delete: <Path extends keyof Routes & string>(path: Path, requestOptions?: Omit<RequestOptions<Routes[Path]>, 'body'>) => request('DELETE', path, requestOptions)
  };
}
