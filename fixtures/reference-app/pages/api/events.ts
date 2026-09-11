import { createSseStream } from '../../../../src/streaming.ts';

async function* events() {
  yield { type: 'ready' };
  yield { type: 'heartbeat' };
}

export function GET({ signal }: { signal: AbortSignal }) {
  return { stream: createSseStream(events(), { signal, event: 'reference' }), headers: { 'Cache-Control': 'no-cache' } };
}
