import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

export function renderPage(value: ReactNode): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  return renderToStaticMarkup(value);
}
