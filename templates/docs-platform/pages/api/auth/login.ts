import type { ApiHandler } from '@kvantjs/ryvax.js';
import { createSupabase, demoMode, formValue, siteUrl } from '../../../src/services.js';

export const POST: ApiHandler = async (context) => {
  if (demoMode(context.env)) return { status: 303, redirect: '/workspace' };
  const email = formValue(context.body, 'email');
  const password = formValue(context.body, 'password');
  if (!email || password.length < 8) return { status: 303, redirect: '/login?error=invalid' };
  const supabase = createSupabase(context);
  if (!supabase) return { status: 503, json: { error: 'Supabase is not configured.' } };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { status: 303, redirect: `/login?error=${encodeURIComponent(error.message)}` };
  return { status: 303, redirect: `${siteUrl(context.env)}/workspace` };
};

