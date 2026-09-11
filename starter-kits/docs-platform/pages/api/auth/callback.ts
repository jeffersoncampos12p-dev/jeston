import type { ApiHandler } from '@kvantjs/ryvax.js';
import { createSupabase } from '../../../src/services.js';

export const GET: ApiHandler = async (context) => {
  const code = context.query.get('code');
  if (!code) return { status: 303, redirect: '/login?error=missing-code' };
  const supabase = createSupabase(context);
  if (!supabase) return { status: 503, json: { error: 'Supabase is not configured.' } };
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? { status: 303, redirect: `/login?error=${encodeURIComponent(error.message)}` } : { status: 303, redirect: '/workspace' };
};

