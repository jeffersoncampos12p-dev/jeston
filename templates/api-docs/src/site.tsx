export function appPath(path: string): string {
  if (!path.startsWith('/')) return path;
  const prefix = typeof process !== 'undefined' && process.env?.PUBLIC_BASE_PATH ? process.env.PUBLIC_BASE_PATH.replace(/\/$/, '') : '';
  return `${prefix}${path}` || '/';
}
