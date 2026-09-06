import { composeMiddleware } from './middleware.js';
import { matchRoute } from './router.js';
import type { ApiModule, AppConfig, PageModule, RequestContext, ResponseLike, RouteDefinition, RouteManifest } from './types.js';

export type EdgeRouteModule = PageModule & ApiModule;
export type EdgeRouteLoader = (route: RouteDefinition) => Promise<EdgeRouteModule>;

/**
 * Fetch adapter for Edge runtimes. On Edge platforms, provide a loader that
 * resolve modules bundled by the provider bundler. Em Node, o loader
 * default loader reads ESM bundles from the manifest directly from the filesystem.
 */
export function createEdgeHandler(manifest: RouteManifest, config: AppConfig = {}, loadRoute: EdgeRouteLoader = loadNodeRoute): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const matched = manifest.routes
      .map((route) => ({ route, match: matchRoute(route, url.pathname) }))
      .find((item) => item.match);
    if (!matched?.match) return Response.json({ error: 'Route not found' }, { status: 404 });

    const context: RequestContext = {
      request: request as unknown as RequestContext['request'],
      response: {} as RequestContext['response'],
      url,
      params: matched.match.params,
      query: url.searchParams,
      headers: headersToRecord(request.headers),
      body: await readBody(request),
      runtime: 'edge',
      state: {},
      env: { ...config.env }
    };
    const module = await loadRoute(matched.route);
    const terminal = async (ctx: RequestContext): Promise<ResponseLike> => {
      if (matched.route.kind === 'api') {
        const handler = module[request.method as keyof ApiModule] as ((ctx: RequestContext) => ResponseLike | Promise<ResponseLike>) | undefined;
        if (!handler && !module.default) return { status: 405, json: { error: `Method ${request.method} not allowed` } };
        return (handler ?? module.default)!(ctx);
      }
      const props = module.getServerSideProps ? await module.getServerSideProps(ctx) : module.getStaticProps ? await module.getStaticProps(ctx) : {};
      return { body: await module.default(props, ctx), headers: module.headers };
    };
    const routeMiddleware = matched.route.kind === 'api' ? (module.middleware ?? []) : [];
    const result = await composeMiddleware([...(config.middleware ?? []), ...routeMiddleware], terminal)(context);
    return toResponse(result);
  };
}

async function loadNodeRoute(route: RouteDefinition): Promise<EdgeRouteModule> {
  const { pathToFileURL } = await import('node:url');
  return await import(`${pathToFileURL(route.bundle).href}?edge=${Date.now()}`) as EdgeRouteModule;
}

async function readBody(request: Request): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const text = await request.text();
  if (!text) return undefined;
  return request.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text;
}

function toResponse(result: ResponseLike): Response {
  const headers = new Headers(result.headers);
  if (result.redirect) return Response.redirect(result.redirect, result.status ?? 302);
  if (result.json !== undefined) {
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(result.json), { status: result.status ?? 200, headers });
  }
  return new Response(typeof result.body === 'string' ? result.body : JSON.stringify(result.body ?? ''), { status: result.status ?? 200, headers });
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => { record[key] = value; });
  return record;
}
