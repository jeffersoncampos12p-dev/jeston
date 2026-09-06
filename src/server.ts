import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderToPipeableStream } from 'react-dom/server';
import type { ReactNode } from 'react';
import { ResponseCache } from './cache.js';
import { composeMiddleware } from './middleware.js';
import { matchRouteWithPattern, routePattern } from './router.js';
import { defaultSecurityHeaders, setCacheHeaders } from './security.js';
import { createLogger, createRequestId } from './logger.js';
import { renderPage } from './render.js';
import type { ApiModule, AppConfig, PageModule, RequestContext, ResponseLike, RouteDefinition, RouteManifest } from './types.js';

export interface HmrHub {
  connect(response: ServerResponse): void;
  broadcast(): void;
}

export interface AppServer {
  server: Server;
  listen(port?: number, host?: string): Promise<void>;
  close(): Promise<void>;
}

export function createHmrHub(): HmrHub {
  const clients = new Set<ServerResponse>();
  return {
    connect(response) {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      response.write(`event: connected\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
      clients.add(response);
      response.on('close', () => clients.delete(response));
    },
    broadcast() {
      for (const client of clients) client.write(`event: reload\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
    }
  };
}

export function createAppServer(manifest: RouteManifest, config: AppConfig = {}, hmr?: HmrHub): AppServer {
  const rootDir = resolve(config.rootDir ?? process.cwd());
  const cache = new ResponseCache();
  const logger = createLogger({ service: 'jeston', ...(config.logging ?? {}) });
  const routes = manifest.routes;
  const routeMatchers = routes.map((route) => ({ route, pattern: routePattern(route.segments) }));
  const moduleCache = new Map<string, PageModule & ApiModule>();
  const env = Object.freeze({ ...process.env, ...config.env });
  const securityHeaders = { ...defaultSecurityHeaders, ...(config.securityHeaders ?? {}) };
  const logRequests = config.observability?.requestLogging ?? process.env.NODE_ENV !== 'production';
  const includeRequestId = config.observability?.requestId !== false;
  const server = createHttpServer(async (request, response) => {
    try {
      await handleRequest(request, response);
    } catch (error) {
      logger.error('Unhandled request error', error instanceof Error ? error : { error });
      await sendError(response, error, request.url?.startsWith('/api/') ?? false);
    }
  });

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const requestId = includeRequestId ? createRequestId(typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined) : undefined;
    if (requestId) response.setHeader('X-Request-Id', requestId);
    const startedAt = performance.now();
    if (logRequests && logger.isEnabled('debug')) logger.debug('Request started', { requestId, method: request.method ?? 'GET', path: url.pathname });
    for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
    if (config.poweredBy !== false) response.setHeader('X-Powered-By', 'Jeston');
    if (url.pathname === '/_meu/hmr' && hmr) return hmr.connect(response);
    if (url.pathname.startsWith('/_meu/static/')) return serveStatic(url.pathname, response, rootDir);
    if (await servePublic(url.pathname, response, rootDir)) return;
    if (request.method === 'GET' && await serveGeneratedPage(url.pathname, response, rootDir)) return;

    const match = routeMatchers.map(({ route, pattern }) => ({ route, match: matchRouteWithPattern(route, pattern, url.pathname) })).find((item) => item.match);
    if (!match?.match) {
      response.statusCode = 404;
      response.end(url.pathname.startsWith('/api/') ? JSON.stringify({ error: 'Rota não encontrada' }) : '<h1>404 - Página não encontrada</h1>');
      return;
    }
    const { route } = match;
    const context = await createContext(request, response, url, match.match.params, config, env);
    let module = moduleCache.get(route.bundle);
    if (!module) {
      module = await import(pathToFileURL(route.bundle).href) as PageModule & ApiModule;
      moduleCache.set(route.bundle, module);
    }
    const terminal = async (ctx: RequestContext): Promise<ResponseLike> => route.kind === 'api'
      ? handleApi(module, request.method ?? 'GET', ctx)
      : handlePage(module, route, ctx, cache);
    const routeMiddleware = route.kind === 'api' ? (module.middleware ?? []) : [];
    const responseLike = await composeMiddleware([...(config.middleware ?? []), ...routeMiddleware], terminal)(context);
    await sendResponse(response, responseLike, route, config);
    if (logRequests && logger.isEnabled('info')) logger.info('Request completed', { requestId, method: request.method ?? 'GET', path: url.pathname, status: responseLike.status ?? 200, durationMs: Number((performance.now() - startedAt).toFixed(3)) });
  }

  return {
    server,
    listen(port = config.port ?? 3000, host = config.host ?? '0.0.0.0') {
      return new Promise((resolvePromise, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolvePromise();
        });
      });
    },
    close() {
      return new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()));
    }
  };
}

async function handleApi(module: ApiModule, method: string, context: RequestContext): Promise<ResponseLike> {
  const handler = module[method as keyof ApiModule] as ((context: RequestContext) => ResponseLike | Promise<ResponseLike>) | undefined;
  if (!handler && !module.default) return { status: 405, json: { error: `Método ${method} não permitido` } };
  return (handler ?? module.default)!(context);
}

async function handlePage(module: PageModule, route: RouteDefinition, context: RequestContext, cache: ResponseCache): Promise<ResponseLike> {
  const revalidate = module.revalidate;
  const cacheKey = `page:${route.id}:${context.url.pathname}${context.url.search}`;
  if (revalidate) {
    const cached = cache.get<string>(cacheKey);
    if (cached) return { body: cached, headers: module.headers, status: 200 };
  }
  const props = module.getServerSideProps
    ? await module.getServerSideProps(context)
    : module.getStaticProps
      ? await module.getStaticProps()
      : {};
  const body = renderPage(await module.default(props, context));
  if (revalidate) cache.set(cacheKey, body, revalidate);
  return { body, headers: module.headers, status: 200 };
}

async function createContext(request: IncomingMessage, response: ServerResponse, url: URL, params: Record<string, string | string[]>, config: AppConfig, env: Record<string, string | undefined>): Promise<RequestContext> {
  return {
    request,
    response,
    url,
    params,
    query: url.searchParams,
    headers: request.headers,
    body: await parseBody(request),
    runtime: config.runtime ?? 'node',
    state: {},
    env
  };
}

async function parseBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  const contentType = request.headers['content-type'] ?? '';
  if (contentType.includes('application/json')) {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

async function sendResponse(response: ServerResponse, result: ResponseLike, route: RouteDefinition, config: AppConfig): Promise<void> {
  const status = result.status ?? 200;
  response.statusCode = status;
  for (const [key, value] of Object.entries(result.headers ?? {})) response.setHeader(key, value);
  if (result.redirect) {
    response.setHeader('Location', result.redirect);
    response.end();
    return;
  }
  if (result.stream) {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    for await (const chunk of result.stream) response.write(chunk);
    response.end();
    return;
  }
  if (result.react !== undefined) {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    await streamReact(response, result.react);
    return;
  }
  if (result.json !== undefined) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (route.kind === 'api') setCacheHeaders(response, { private: true, maxAge: 0 });
    response.end(JSON.stringify(result.json));
    return;
  }
  const body = result.body ?? '';
  if (typeof body === 'object') {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(body));
    return;
  }
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (route.kind !== 'api' && config.cache?.enabled !== false) {
    setCacheHeaders(response, {
      maxAge: config.cache?.defaultTtl ?? 0,
      sMaxAge: config.cache?.defaultTtl ?? 0,
      staleWhileRevalidate: config.cache?.staleWhileRevalidate
    });
  }
  response.end(String(body));
}

async function streamReact(response: ServerResponse, element: ReactNode): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolvePromise();
    };
    const rendered = renderToPipeableStream(element, {
      onShellReady() {
        rendered.pipe(response);
      },
      onShellError(error) {
        if (!response.headersSent) {
          response.statusCode = 500;
          response.end('React SSR render error');
        }
        if (!settled) {
          settled = true;
          reject(error);
        }
      },
      onError(error) {
        if (!response.headersSent && !settled) {
          settled = true;
          reject(error);
        }
      }
    });
    response.once('finish', finish);
    response.once('close', finish);
  });
}

async function sendError(response: ServerResponse, error: unknown, api: boolean): Promise<void> {
  const message = error instanceof Error ? error.message : 'Erro interno';
  response.statusCode = 500;
  if (api) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: message }));
  } else {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<h1>500 - Erro interno</h1><pre>${escapeHtml(message)}</pre>`);
  }
}

async function serveStatic(pathname: string, response: ServerResponse, rootDir: string): Promise<void> {
  const relativePath = pathname.slice('/_meu/static/'.length).replaceAll('..', '');
  const file = join(rootDir, '.meu', 'static', relativePath);
  try {
    const contents = await readFile(file);
    response.statusCode = 200;
    response.setHeader('Content-Type', contentType(file));
    response.end(contents);
  } catch {
    response.statusCode = 404;
    response.end('Not found');
  }
}

async function servePublic(pathname: string, response: ServerResponse, rootDir: string): Promise<boolean> {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1).replaceAll('..', '');
  const file = join(rootDir, 'public', relativePath);
  try {
    const contents = await readFile(file);
    response.statusCode = 200;
    response.setHeader('Content-Type', contentType(file));
    response.end(contents);
    return true;
  } catch {
    return false;
  }
}

async function serveGeneratedPage(pathname: string, response: ServerResponse, rootDir: string): Promise<boolean> {
  const relativePath = pathname === '/' ? 'index.html' : `${pathname.slice(1).replaceAll('..', '')}/index.html`;
  const file = join(rootDir, '.meu', 'static', relativePath);
  try {
    const contents = await readFile(file);
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    setCacheHeaders(response, { maxAge: 31536000, sMaxAge: 31536000 });
    response.end(contents);
    return true;
  } catch {
    return false;
  }
}

function contentType(file: string): string {
  return ({ '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8' } as Record<string, string>)[extname(file)] ?? 'application/octet-stream';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

export { defaultSecurityHeaders };
