import type { ApiHandler } from '@kvantjs/ryvax.js';
import { createDocument, currentUser, listDocuments, requireBodyRecord } from '../../src/services.js';

export const GET: ApiHandler = async (context) => {
  const user = await currentUser(context);
  if (!user) return { status: 401, json: { error: 'Authentication required.' } };
  try { return { json: { data: await listDocuments(context, user.id) }, headers: { 'Cache-Control': 'no-store' } }; }
  catch (error) { return { status: 500, json: { error: error instanceof Error ? error.message : 'Could not load documents.' } }; }
};

export const POST: ApiHandler = async (context) => {
  const user = await currentUser(context);
  if (!user) return { status: 401, json: { error: 'Authentication required.' } };
  try {
    const input = typeof context.body === 'string' ? Object.fromEntries(new URLSearchParams(context.body)) : requireBodyRecord(context.body);
    await createDocument(context, user.id, input);
    return { status: 303, redirect: '/workspace' };
  } catch (error) { return { status: 422, json: { error: error instanceof Error ? error.message : 'Could not create document.' } }; }
};
