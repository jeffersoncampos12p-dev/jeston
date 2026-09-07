import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import type { ReactNode } from 'react';
import type { LoggerOptions } from './logger.js';

export type Runtime = 'node' | 'edge';
export type RenderMode = 'ssr' | 'ssg' | 'api';

export interface RouteParams {
  [key: string]: string | string[];
}

export interface RequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  signal: AbortSignal;
  url: URL;
  params: RouteParams;
  query: URLSearchParams;
  headers: IncomingHttpHeaders;
  body: unknown;
  runtime: Runtime;
  state: Record<string, unknown>;
  env: Record<string, string | undefined>;
}

export type PageComponent<P = Record<string, unknown>> = (
  props: P,
  context: RequestContext,
) => ReactNode | Promise<ReactNode>;

export interface PageModule<P = Record<string, unknown>> {
  default: PageComponent<P>;
  getServerSideProps?: (context: RequestContext) => P | Promise<P>;
  getStaticProps?: (context?: RequestContext) => P | Promise<P>;
  getStaticPaths?: () => RouteParams[] | Promise<RouteParams[]>;
  revalidate?: number;
  headers?: Record<string, string>;
}

export type ApiHandler = (context: RequestContext) => ResponseLike | Promise<ResponseLike>;

export interface ApiModule {
  default?: ApiHandler;
  GET?: ApiHandler;
  POST?: ApiHandler;
  PUT?: ApiHandler;
  PATCH?: ApiHandler;
  DELETE?: ApiHandler;
  OPTIONS?: ApiHandler;
  HEAD?: ApiHandler;
  middleware?: Middleware[];
}

export interface ResponseLike {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
  react?: ReactNode;
  json?: unknown;
  redirect?: string;
  stream?: AsyncIterable<Uint8Array>;
}

export type NextHandler = () => ResponseLike | Promise<ResponseLike>;
export type Middleware = (context: RequestContext, next: NextHandler) => ResponseLike | Promise<ResponseLike>;

export interface RouteDefinition {
  id: string;
  kind: RenderMode;
  pathname: string;
  pattern: string;
  file: string;
  bundle: string;
  segments: string[];
  dynamic: boolean;
  catchAll: boolean;
}

export interface RouteManifest {
  generatedAt: string;
  routes: RouteDefinition[];
  client?: {
    entry: string;
  };
}

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
  staleAt?: number;
  tags?: string[];
}

export interface CachePolicy {
  ttl?: number;
  staleWhileRevalidate?: number;
  tags?: string[];
  namespace?: string;
  version?: string;
}

export interface AppConfig {
  rootDir?: string;
  port?: number;
  host?: string;
  runtime?: Runtime;
  securityHeaders?: Record<string, string>;
  poweredBy?: boolean;
  cache?: {
    enabled?: boolean;
    defaultTtl?: number;
    staleWhileRevalidate?: number;
  };
  middleware?: Middleware[];
  env?: Record<string, string | undefined>;
  logging?: LoggerOptions;
  observability?: {
    requestId?: boolean;
    requestLogging?: boolean;
  };
  limits?: {
    bodyBytes?: number;
    requestTimeoutMs?: number;
    shutdownTimeoutMs?: number;
  };
}

export interface DatabaseAdapter {
  findMany<T = unknown>(table: string, query?: Record<string, unknown>): Promise<T[]>;
  findUnique<T = unknown>(table: string, query: Record<string, unknown>): Promise<T | null>;
  create<T = unknown>(table: string, data: Record<string, unknown>): Promise<T>;
  update<T = unknown>(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<T>;
  delete<T = unknown>(table: string, where: Record<string, unknown>): Promise<T>;
}

export interface BuildOptions {
  rootDir: string;
  outDir?: string;
  mode?: 'development' | 'production';
  sourcemap?: boolean;
  minify?: boolean;
  watch?: boolean;
}
