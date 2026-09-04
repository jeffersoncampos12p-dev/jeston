export interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
}

export function navigate(url: string, options: NavigateOptions = {}): void {
  if (options.replace) history.replaceState({}, '', url);
  else history.pushState({}, '', url);
  if (options.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function installHmr(url = '/_meu/hmr'): EventSource | undefined {
  if (typeof EventSource === 'undefined') return undefined;
  const source = new EventSource(url);
  source.addEventListener('reload', () => window.location.reload());
  return source;
}
