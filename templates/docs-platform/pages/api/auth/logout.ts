import type { ApiHandler } from '@kvantjs/ryvax.js';
import { createSupabase, demoMode } from '../../../src/services.js';

export const POST: ApiHandler = async (context) => {
  if (!demoMode(context.env)) {
    const supabase = createSupabase(context);
    if (supabase) await supabase.auth.signOut({ scope: 'local' });
  }
  return { status: 303, redirect: '/' };
};

