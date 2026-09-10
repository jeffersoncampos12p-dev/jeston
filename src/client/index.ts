import { hydrateRoot, createRoot, type Root } from 'react-dom/client';
import { createElement, useCallback, useEffect, useRef, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

export interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
}

export type PrefetchMode = boolean | 'intent' | 'viewport';

export interface RouterEvents {
  onNavigate?: (url: string) => void;
  onError?: (error: unknown, url: string) => void;
}

export interface ClientRouter {
  push(url: string, options?: NavigateOptions): Promise<void>;
  replace(url: string, options?: NavigateOptions): Promise<void>;
  prefetch(url: string, options?: { signal?: AbortSignal }): Promise<Response | undefined>;
  refresh(): Promise<void>;
}

export interface ActionClientOptions { endpoint?: string; signal?: AbortSignal; }

export async function invokeAction<TInput, TResult>(id: string, input: TInput, options: ActionClientOptions = {}): Promise<TResult> {
  const response = await fetch(`${options.endpoint ?? '/_meu/action'}/${encodeURIComponent(id)}`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(input), signal: options.signal
  });
  const payload = await response.json() as { ok?: boolean; result?: TResult; error?: { message?: string } };
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? `Action failed with HTTP ${response.status}`);
  return payload.result as TResult;
}

export function useServerAction<TInput, TResult>(id: string, options: Omit<ActionClientOptions, 'signal'> = {}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const execute = useCallback(async (input: TInput) => {
    setPending(true); setError(undefined);
    try { return await invokeAction<TInput, TResult>(id, input, options); }
    catch (caught) { const next = caught instanceof Error ? caught : new Error(String(caught)); setError(next); throw next; }
    finally { setPending(false); }
  }, [id, options.endpoint]);
  return { execute, pending, error };
}

const payloadCache = new Map<string, Response>();

export function navigate(url: string, options: NavigateOptions = {}): void {
  if (options.replace) history.replaceState({}, '', url);
  else history.pushState({}, '', url);
  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function createRouter(events: RouterEvents = {}): ClientRouter {
  const transition = async (url: string, options: NavigateOptions, replace: boolean) => {
    try {
      await prefetch(url);
      navigate(url, { ...options, replace });
      events.onNavigate?.(url);
    } catch (error) {
      events.onError?.(error, url);
      throw error;
    }
  };
  return {
    push: (url, options = {}) => transition(url, options, false),
    replace: (url, options = {}) => transition(url, options, true),
    prefetch,
    async refresh() {
      payloadCache.delete(window.location.href);
      await prefetch(window.location.href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };
}

export async function prefetch(url: string, options: { signal?: AbortSignal } = {}): Promise<Response | undefined> {
  if (typeof window === 'undefined') return undefined;
  const target = new URL(url, window.location.href);
  if (target.origin !== window.location.origin) return undefined;
  const key = target.href;
  const cached = payloadCache.get(key);
  if (cached) return cached.clone();
  const response = await fetch(target.href, { headers: { Accept: 'text/html', 'X-Ryvax-Prefetch': '1' }, signal: options.signal });
  if (response.ok) payloadCache.set(key, response.clone());
  return response;
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  prefetch?: PrefetchMode;
  replace?: boolean;
  scroll?: boolean;
}

export function Link({ href, prefetch: mode = 'intent', replace = false, scroll = true, onClick, onMouseEnter, ...props }: LinkProps) {
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const startPrefetch = () => {
    if (mode === false) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void prefetch(href, { signal: controller.signal });
  };
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin) return;
    event.preventDefault();
    void createRouter().push(target.href, { replace, scroll });
  };
  return createElement('a', { ...props, href, onClick: handleClick, onMouseEnter: (event: MouseEvent<HTMLAnchorElement>) => { onMouseEnter?.(event); startPrefetch(); } });
}

export function installHmr(url = '/_meu/hmr'): EventSource | undefined {
  if (typeof EventSource === 'undefined') return undefined;
  const source = new EventSource(url);
  source.addEventListener('reload', () => window.location.reload());
  return source;
}

export function hydrate(element: ReactNode, selector = '#root'): Root {
  const container = document.querySelector(selector);
  if (!(container instanceof HTMLElement)) throw new Error(`Ryvax: container React not found: ${selector}`);
  return hydrateRoot(container, element);
}

export function mount(element: ReactNode, selector = '#root'): Root {
  const container = document.querySelector(selector);
  if (!(container instanceof HTMLElement)) throw new Error(`Ryvax: container React not found: ${selector}`);
  const root = createRoot(container);
  root.render(element);
  return root;
}
