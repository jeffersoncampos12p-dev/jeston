import { composeMiddleware } from './middleware.js';
import { matchRoute } from './router.js';
import type { ApiModule, AppConfig, PageModule, RequestContext, ResponseLike, RouteDefinition, RouteManifest } from './types.js';

export type EdgeRouteModule = PageModule & ApiModule;
export type EdgeRouteLoader = (route: RouteDefinition) => Promise<EdgeRouteModule>;

export function createEdgeHandler(manifest: RouteManifest, config: AppConfig = {}, loadRoute: EdgeRouteLoader = loadNodeRoute): (request: Request) => Promise<Response> {
  return createFetchHandler(manifest, config, loadRoute, 'edge');
}

export function createFetchHandler(manifest: RouteManifest, config: AppConfig = {}, loadRoute: EdgeRouteLoader = loadNodeRoute, runtime: 'node' | 'edge' = 'edge'): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const matched = manifest.routes.map((route) => ({ route, match: matchRoute(route, url.pathname) })).find((item) => item.match);
    if (!matched?.match) return Response.json({ error: 'Route not found' }, { status: 404 });
    let body: unknown;
    try { body = await readBody(request); } catch { return Response.json({ error: 'Malformed JSON body' }, { status: 400 }); }
    const context: RequestContext = {
      request: request as unknown as RequestContext['request'], response: {} as RequestContext['response'], signal: request.signal,
      url, params: matched.match.params, query: url.searchParams, headers: headersToRecord(request.headers), body,
      runtime, state: {}, env: { ...config.env }, method: request.method
    };
    const module = await loadRoute(matched.route);
    const terminal = async (ctx: RequestContext): Promise<ResponseLike> => {
      if (matched.route.kind === 'api') {
        const methods = allowedMethods(module);
        if (request.method === 'OPTIONS' && !module.OPTIONS) return { status: 204, headers: { Allow: methods.join(', ') } };
        const handler = request.method === 'HEAD' && !module.HEAD ? module.GET : module[request.method as keyof ApiModule] as ((ctx: RequestContext) => ResponseLike | Promise<ResponseLike>) | undefined;
        if (!handler && !module.default) return { status: 405, headers: { Allow: methods.join(', ') }, json: { error: `Method ${request.method} not allowed` } };
        return (handler ?? module.default)!(ctx);
      }
      const props = module.getServerSideProps ? await module.getServerSideProps(ctx) : module.getStaticProps ? await module.getStaticProps(ctx) : {};
      return { body: await module.default(props, ctx), headers: module.headers };
    };
    const result = await composeMiddleware([...(config.middleware ?? []), ...(matched.route.kind === 'api' ? (module.middleware ?? []) : [])], terminal)(context);
    return toResponse(result, request.method === 'HEAD');
  };
}

async function loadNodeRoute(route: RouteDefinition): Promise<EdgeRouteModule> {
  const { pathToFileURL } = await import('node:url');
  return await import(`${pathToFileURL(route.bundle).href}?edge=${Date.now()}`) as EdgeRouteModule;
}

async function readBody(request: Request): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return undefined;
  const text = await request.text();
  if (!text) return undefined;
  return request.headers.get('content-type')?.toLowerCase().includes('application/json') ? JSON.parse(text) : text;
}

function allowedMethods(module: ApiModule): string[] {
  const methods = (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const).filter((method) => typeof module[method] === 'function');
  if (typeof module.GET === 'function' && !methods.includes('HEAD')) methods.push('HEAD');
  if (methods.length === 0 && module.default) methods.push('GET', 'HEAD');
  if (!methods.includes('OPTIONS')) methods.push('OPTIONS');
  return methods;
}

function toResponse(result: ResponseLike, isHead: boolean): Response {
  const headers = new Headers(result.headers);
  if (result.redirect) return Response.redirect(result.redirect, result.status ?? 302);
  if (result.stream) {
    headers.set('content-type', headers.get('content-type') ?? 'text/event-stream; charset=utf-8');
    return new Response(isHead ? null : result.stream instanceof ReadableStream ? result.stream : asyncIterableToStream(result.stream), { status: result.status ?? 200, headers });
  }
  if (result.json !== undefined) {
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(isHead ? null : JSON.stringify(result.json), { status: result.status ?? 200, headers });
  }
  const body = result.body === undefined ? '' : typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
  return new Response(isHead ? null : body, { status: result.status ?? 200, headers });
}

function asyncIterableToStream(iterable: AsyncIterable<Uint8Array>): ReadableStream<Uint8Array> {
  const iterator = iterable[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) { try { const next = await iterator.next(); if (next.done) controller.close(); else controller.enqueue(next.value); } catch (error) { controller.error(error); } },
    async cancel() { await iterator.return?.(); }
  });
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => { record[key] = value; });
  return record;
}
