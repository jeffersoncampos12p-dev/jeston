import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderToPipeableStream } from 'react-dom/server';
import type { ReactNode } from 'react';
import { ResponseCache } from './cache.js';
import { composeMiddleware } from './middleware.js';
import { matchRouteWithPattern, routePattern } from './router.js';
import { createSecureSecurityHeaders, defaultSecurityHeaders, setCacheHeaders } from './security.js';
import { createLogger, createRequestId } from './logger.js';
import { renderPage } from './render.js';
import { ActionError, createActionRegistry } from './actions.js';
import type { ApiModule, AppConfig, BoundaryModule, LayoutModule, PageModule, RequestContext, ResponseLike, RouteDefinition, RouteManifest } from './types.js';

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
      response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      response.write(`event: connected\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
      clients.add(response);
      response.on('close', () => clients.delete(response));
    },
    broadcast() {
      for (const client of clients) {
        if (!client.destroyed && !client.writableEnded) client.write(`event: reload\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
      }
    }
  };
}

export function createAppServer(manifest: RouteManifest, config: AppConfig = {}, hmr?: HmrHub): AppServer {
  const rootDir = resolve(config.rootDir ?? process.cwd());
  const cache = new ResponseCache({ maxEntries: config.cache?.maxEntries, onMetric: (name, value) => config.observability?.metrics?.counter(`ryvax_cache_${name}`, value) });
  const logger = createLogger({ service: 'ryvax', ...(config.logging ?? {}) });
  const routes = manifest.routes;
  const routeMatchers = routes.map((route) => ({ route, pattern: routePattern(route.segments) }));
  const moduleCache = new Map<string, PageModule & ApiModule>();
  const layoutCache = new Map<string, LayoutModule>();
  const boundaryCache = new Map<string, BoundaryModule>();
  const actionRegistry = manifest.actions?.length
    ? createActionRegistry(manifest.actions, { allowedOrigins: config.actions?.allowedOrigins, csrf: config.actions?.csrf, timeoutMs: config.limits?.actionTimeoutMs })
    : undefined;
  const env = Object.freeze({ ...process.env, ...config.env });
  const securityHeaders = { ...(config.security ? createSecureSecurityHeaders(config.security.cspNonce, { trustedTypes: config.security.trustedTypes }) : defaultSecurityHeaders), ...(config.securityHeaders ?? {}) };
  const logRequests = config.observability?.requestLogging ?? process.env.NODE_ENV !== 'production';
  const includeRequestId = config.observability?.requestId !== false;
  const sockets = new Set<import('node:net').Socket>();
  const server = createHttpServer(async (request, response) => {
    try {
      await handleRequest(request, response);
    } catch (error) {
      logger.error('Unhandled request error', error instanceof Error ? error : { error });
      await sendError(response, error, request.url?.startsWith('/api/') ?? false);
    }
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  server.requestTimeout = config.limits?.requestTimeoutMs ?? 120_000;
  server.headersTimeout = Math.max(server.requestTimeout, 60_000);

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const controller = new AbortController();
    const requestTimeoutMs = Math.max(1, config.limits?.requestTimeoutMs ?? 120_000);
    const timeout = setTimeout(() => controller.abort(new HttpError(408, 'Request timeout')), requestTimeoutMs);
    timeout.unref();
    const abort = (reason: unknown = new HttpError(499, 'Request aborted')) => {
      if (!controller.signal.aborted) controller.abort(reason);
    };
    const onRequestAborted = () => abort();
    const onRequestClose = () => { if (!request.complete) abort(); };
    const onResponseClose = () => { if (!response.writableEnded) abort(); };
    request.once('aborted', onRequestAborted);
    request.once('close', onRequestClose);
    response.once('close', onResponseClose);
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const method = (request.method ?? 'GET').toUpperCase();
    const requestId = includeRequestId ? createRequestId(typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined) : undefined;
    const startedAt = performance.now();
    if (requestId) response.setHeader('X-Request-Id', requestId);
    if (logRequests && logger.isEnabled('debug')) logger.debug('Request started', { requestId, method, path: url.pathname });
    config.observability?.metrics?.counter('ryvax_requests_total', 1, { method, path: url.pathname });
    try {
      for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
      if (config.poweredBy !== false) response.setHeader('X-Powered-By', 'Ryvax');
      if (config.health && (url.pathname === (config.healthPath ?? '/health') || url.pathname === (config.readinessPath ?? '/ready'))) {
        await sendHealth(response, config, url.pathname === (config.readinessPath ?? '/ready'), controller.signal);
        return;
      }
      if (url.pathname === '/_meu/hmr' && hmr) {
        if (method !== 'GET' && method !== 'HEAD') {
          response.statusCode = 405;
          response.setHeader('Allow', 'GET, HEAD');
          response.end();
        } else if (method === 'HEAD') {
          response.statusCode = 200;
          response.end();
        } else hmr.connect(response);
        return;
      }
      const actionPath = config.actions?.path ?? '/_meu/action';
      if (actionRegistry && url.pathname.startsWith(`${actionPath}/`)) {
        if (method !== 'POST') {
          response.statusCode = 405;
          response.setHeader('Allow', 'POST');
          response.end();
          return;
        }
        const id = decodeURIComponent(url.pathname.slice(actionPath.length + 1));
        const actionConfig = { ...config, limits: { ...config.limits, bodyBytes: config.limits?.actionBytes ?? config.limits?.bodyBytes } };
        const context = await createContext(request, response, url, {}, actionConfig, env, controller.signal, requestId, requestTimeoutMs);
        try {
          const result = await actionRegistry.invoke(id, context.body, {
            origin: typeof request.headers.origin === 'string' ? request.headers.origin : undefined,
            host: typeof request.headers.host === 'string' ? request.headers.host : undefined,
            request: new Request(url, { method, headers: Object.entries(request.headers).flatMap(([key, value]) => value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value]]) as [string, string][] }),
            signal: controller.signal, env: { ...env }, state: context.state
          });
          await sendResponse(response, { status: 200, json: { ok: true, result } }, { kind: 'api' } as RouteDefinition, config, controller.signal, false);
        } catch (error) {
          const actionError = error instanceof ActionError ? error : new ActionError(500, 'Action failed');
          await sendResponse(response, { status: actionError.status, json: { ok: false, error: { code: actionError.code, message: actionError.message } } }, { kind: 'api' } as RouteDefinition, config, controller.signal, false);
        }
        return;
      }
      if (url.pathname.startsWith('/_meu/static/')) {
        await serveStatic(url.pathname, response, rootDir, method === 'HEAD');
        return;
      }
      if (await servePublic(url.pathname, response, rootDir, method === 'HEAD')) return;
      if ((method === 'GET' || method === 'HEAD') && await serveGeneratedPage(url.pathname, response, rootDir, method === 'HEAD')) return;

      const match = routeMatchers.map(({ route, pattern }) => ({ route, match: matchRouteWithPattern(route, pattern, url.pathname) })).find((item) => item.match);
      if (!match?.match) {
        response.statusCode = 404;
        response.setHeader('Content-Type', url.pathname.startsWith('/api/') ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8');
        if (method === 'HEAD') response.end();
        else if (manifest.notFound && !url.pathname.startsWith('/api/')) {
          const boundary = await loadBoundary(manifest.notFound, boundaryCache);
          const context = await createContext(request, response, url, {}, config, env, controller.signal, requestId, requestTimeoutMs);
          response.end(renderPage(await boundary.default({}, context)));
        } else response.end(url.pathname.startsWith('/api/') ? JSON.stringify({ error: 'Route not found' }) : '<h1>404 - Page not found</h1>');
        return;
      }
      const { route } = match;
      let module = moduleCache.get(route.bundle);
      if (!module) {
        module = await import(pathToFileURL(route.bundle).href) as PageModule & ApiModule;
        moduleCache.set(route.bundle, module);
      }
      const allowed = route.kind === 'api' ? allowedMethods(module) : ['GET', 'HEAD'];
      if (route.kind === 'api' && method === 'OPTIONS' && !module.OPTIONS) {
        response.statusCode = 204;
        response.setHeader('Allow', allowed.join(', '));
        response.end();
        return;
      }
      const context = await createContext(request, response, url, match.match.params, config, env, controller.signal, requestId, requestTimeoutMs);
      const terminal = async (ctx: RequestContext): Promise<ResponseLike> => route.kind === 'api'
        ? handleApi(module!, method, ctx, allowed)
        : handlePage(module!, route, ctx, cache, layoutCache, boundaryCache, config);
      const routeMiddleware = route.kind === 'api' ? (module.middleware ?? []) : [];
      const responseLike = await composeMiddleware([...(config.middleware ?? []), ...routeMiddleware], terminal)(context);
      if (route.kind === 'api' && !responseLike.headers?.Allow) responseLike.headers = { ...responseLike.headers, Allow: allowed.join(', ') };
      await sendResponse(response, responseLike, route, config, controller.signal, method === 'HEAD');
      if (logRequests && logger.isEnabled('info')) logger.info('Request completed', { requestId, method, path: url.pathname, status: responseLike.status ?? 200, durationMs: Number((performance.now() - startedAt).toFixed(3)) });
      config.observability?.metrics?.histogram('ryvax_request_duration_ms', Number((performance.now() - startedAt).toFixed(3)), { method, path: url.pathname });
    } finally {
      clearTimeout(timeout);
      request.off('aborted', onRequestAborted);
      request.off('close', onRequestClose);
      response.off('close', onResponseClose);
    }
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
      return new Promise((resolvePromise, reject) => {
        let settled = false;
        let timer: NodeJS.Timeout | undefined;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          error ? reject(error) : resolvePromise();
        };
        server.close((error) => finish(error ?? undefined));
        timer = setTimeout(() => {
          for (const socket of sockets) socket.destroy();
          finish();
        }, config.limits?.shutdownTimeoutMs ?? 10_000);
        timer.unref();
      });
    }
  };
}

async function handleApi(module: ApiModule, method: string, context: RequestContext, allowed: string[]): Promise<ResponseLike> {
  const handler = method === 'HEAD' && !module.HEAD ? module.GET : module[method as keyof ApiModule] as ((context: RequestContext) => ResponseLike | Promise<ResponseLike>) | undefined;
  if (!handler && !module.default) return { status: 405, headers: { Allow: allowed.join(', ') }, json: { error: `Method ${method} not allowed` } };
  return (handler ?? module.default)!(context);
}

function allowedMethods(module: ApiModule): string[] {
  const methods = (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const).filter((method) => typeof module[method] === 'function');
  if (typeof module.GET === 'function' && !methods.includes('HEAD')) methods.push('HEAD');
  if (methods.length === 0 && module.default) methods.push('GET', 'HEAD');
  if (!methods.includes('OPTIONS')) methods.push('OPTIONS');
  return methods;
}

async function handlePage(module: PageModule, route: RouteDefinition, context: RequestContext, cache: ResponseCache, layoutCache: Map<string, LayoutModule>, boundaryCache: Map<string, BoundaryModule>, config: AppConfig): Promise<ResponseLike> {
  const revalidate = module.revalidate;
  let renderedStatus = 200;
  const cacheKey = `page:${route.id}:${context.url.pathname}${context.url.search}`;
  const render = async (): Promise<string> => {
    const props = module.getServerSideProps
      ? await module.getServerSideProps(context)
      : module.getStaticProps
        ? await module.getStaticProps()
        : {};
    try {
      let element = await module.default(props, context);
      for (const layoutBundle of route.layouts ?? []) {
        let layout = layoutCache.get(layoutBundle);
        if (!layout) {
          layout = await import(pathToFileURL(layoutBundle).href) as LayoutModule;
          layoutCache.set(layoutBundle, layout);
        }
        element = await layout.default({ children: element }, context);
      }
      return renderPage(element);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : typeof error === 'object' && error !== null && typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
      const boundaryBundle = status === 401 ? route.unauthorizedBoundary : status === 403 ? route.forbiddenBoundary : route.errorBoundary;
      if (!boundaryBundle) throw error;
      renderedStatus = status;
      const boundary = await loadBoundary(boundaryBundle, boundaryCache);
      return renderPage(await boundary.default({ error }, context));
    }
  };
  if (revalidate) {
    const body = await cache.remember(cacheKey, render, { ttl: revalidate, staleWhileRevalidate: config.cache?.staleWhileRevalidate ?? 0 });
    return { body, headers: module.headers, status: renderedStatus };
  }
  return { body: await render(), headers: module.headers, status: renderedStatus };
}

async function loadBoundary(bundle: string, cache: Map<string, BoundaryModule>): Promise<BoundaryModule> {
  const cached = cache.get(bundle);
  if (cached) return cached;
  const boundary = await import(pathToFileURL(bundle).href) as BoundaryModule;
  cache.set(bundle, boundary);
  return boundary;
}

async function createContext(request: IncomingMessage, response: ServerResponse, url: URL, params: Record<string, string | string[]>, config: AppConfig, env: Record<string, string | undefined>, signal: AbortSignal, requestId: string | undefined, timeoutMs: number): Promise<RequestContext> {
  return {
    request,
    response,
    signal,
    url,
    params,
    query: url.searchParams,
    headers: request.headers,
    body: await parseBody(request, config.limits?.bodyBytes ?? 1024 * 1024, signal),
    runtime: config.runtime ?? 'node',
    state: {},
    env,
    method: request.method,
    requestId,
    timeoutMs,
    deadline: Date.now() + timeoutMs
  };
}

async function parseBody(request: IncomingMessage, maxBytes: number, signal: AbortSignal): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    if (signal.aborted) throw signal.reason instanceof HttpError ? signal.reason : new HttpError(499, 'Request aborted');
    const buffer = Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBytes) throw new HttpError(413, `Payload exceeds the limit of ${maxBytes} bytes`);
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  const contentType = request.headers['content-type'] ?? '';
  if (contentType.toLowerCase().includes('application/json')) {
    try { return JSON.parse(raw); } catch { throw new HttpError(400, 'Malformed JSON body'); }
  }
  return raw;
}

async function sendResponse(response: ServerResponse, result: ResponseLike, route: RouteDefinition, config: AppConfig, signal: AbortSignal, isHead: boolean): Promise<void> {
  if (response.destroyed) return;
  const status = result.status ?? 200;
  response.statusCode = status;
  if (result.statusText) response.statusMessage = result.statusText;
  for (const [key, value] of Object.entries(result.headers ?? {})) response.setHeader(key, value);
  if (result.redirect) {
    response.setHeader('Location', result.redirect);
    response.end();
    return;
  }
  if (result.stream) {
    if (!response.hasHeader('Content-Type')) response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    if (isHead) { response.end(); return; }
    await pipeStream(response, result.stream, signal);
    return;
  }
  if (result.react !== undefined) {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (isHead) { response.end(); return; }
    await streamReact(response, result.react, signal);
    return;
  }
  if (result.json !== undefined) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (route.kind === 'api') setCacheHeaders(response, { private: true, maxAge: 0 });
    const body = JSON.stringify(result.json);
    if (isHead) { response.end(); return; }
    response.end(body);
    return;
  }
  const body = result.body ?? '';
  if (typeof body === 'object') {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (isHead) { response.end(); return; }
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
  response.end(isHead ? undefined : String(body));
}

async function pipeStream(response: ServerResponse, stream: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>, signal: AbortSignal): Promise<void> {
  const readable = isReadableStream(stream);
  const iterator = readable ? undefined : stream[Symbol.asyncIterator]();
  const reader = readable ? stream.getReader() : undefined;
  let aborted = false;
  const abortPromise = new Promise<never>((_, reject) => {
    const onAbort = () => { aborted = true; reject(signal.reason instanceof Error ? signal.reason : new Error('Stream aborted')); };
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    while (!aborted && !response.destroyed && !response.writableEnded) {
      const next = readable ? reader!.read() : iterator!.next();
      const step = await Promise.race([next, abortPromise]);
      if (step.done) break;
      if (!response.write(step.value)) await waitForDrain(response, signal);
    }
  } catch (error) {
    if (!signal.aborted && !response.destroyed) throw error;
  } finally {
    if (readable) await reader?.cancel().catch(() => undefined);
    else await iterator?.return?.();
    response.removeAllListeners('drain');
    if (!response.writableEnded && !response.destroyed) response.end();
  }
}

function isReadableStream(stream: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>): stream is ReadableStream<Uint8Array> {
  return typeof ReadableStream !== 'undefined' && stream instanceof ReadableStream;
}

function waitForDrain(response: ServerResponse, signal: AbortSignal): Promise<void> {
  if (response.destroyed || response.writableEnded || signal.aborted) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onDrain = () => { cleanup(); resolve(); };
    const onAbort = () => { cleanup(); resolve(); };
    const cleanup = () => {
      response.off('drain', onDrain);
      signal.removeEventListener('abort', onAbort);
    };
    response.once('drain', onDrain);
    signal.addEventListener('abort', onAbort, { once: true });
    if (response.destroyed || response.writableEnded) { cleanup(); resolve(); }
  });
}

async function streamReact(response: ServerResponse, element: ReactNode, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    let settled = false;
    let rendered: ReturnType<typeof renderToPipeableStream> | undefined;
    const finish = () => { if (!settled) { settled = true; resolvePromise(); } };
    const onAbort = () => { rendered?.abort(); finish(); };
    signal.addEventListener('abort', onAbort, { once: true });
    rendered = renderToPipeableStream(element, {
      onShellReady() { if (!signal.aborted && !response.destroyed) rendered?.pipe(response); },
      onShellError(error) {
        if (!response.headersSent && !response.destroyed) { response.statusCode = 500; response.end('React SSR render error'); }
        if (!signal.aborted && !settled) { settled = true; reject(error); }
      },
      onError(error) {
        if (!signal.aborted && !response.headersSent && !settled) { settled = true; reject(error); }
      }
    });
    response.once('finish', finish);
    response.once('close', finish);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function sendHealth(response: ServerResponse, config: AppConfig, readiness: boolean, signal: AbortSignal): Promise<void> {
  const report = await config.health!.report({ timeoutMs: config.limits?.healthTimeoutMs, signal });
  const status = report.status === 'ok' ? 200 : 503;
  response.statusCode = readiness ? status : status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify({ ...report, readiness }));
}

async function sendError(response: ServerResponse, error: unknown, api: boolean): Promise<void> {
  if (response.destroyed || response.writableEnded) return;
  const status = error instanceof HttpError ? error.status : 500;
  const message = status >= 500 ? 'Internal error' : error instanceof Error ? error.message : 'Request error';
  response.statusCode = status;
  if (api) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: message }));
  } else {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<h1>${status} - ${status >= 500 ? 'Internal error' : 'Request error'}</h1><pre>${escapeHtml(message)}</pre>`);
  }
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

async function serveStatic(pathname: string, response: ServerResponse, rootDir: string, isHead: boolean): Promise<void> {
  const relativePath = pathname.slice('/_meu/static/'.length).replaceAll('..', '');
  const file = join(rootDir, '.meu', 'static', relativePath);
  try {
    const contents = await readFile(file);
    response.statusCode = 200;
    response.setHeader('Content-Type', contentType(file));
    response.end(isHead ? undefined : contents);
  } catch {
    response.statusCode = 404;
    response.end(isHead ? undefined : 'Not found');
  }
}

async function servePublic(pathname: string, response: ServerResponse, rootDir: string, isHead: boolean): Promise<boolean> {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1).replaceAll('..', '');
  const file = join(rootDir, 'public', relativePath);
  try {
    const contents = await readFile(file);
    response.statusCode = 200;
    response.setHeader('Content-Type', contentType(file));
    response.end(isHead ? undefined : contents);
    return true;
  } catch {
    return false;
  }
}

async function serveGeneratedPage(pathname: string, response: ServerResponse, rootDir: string, isHead: boolean): Promise<boolean> {
  const relativePath = pathname === '/' ? 'index.html' : `${pathname.slice(1).replaceAll('..', '')}/index.html`;
  const file = join(rootDir, '.meu', 'static', relativePath);
  try {
    const contents = await readFile(file);
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    setCacheHeaders(response, { maxAge: 31536000, sMaxAge: 31536000 });
    response.end(isHead ? undefined : contents);
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
