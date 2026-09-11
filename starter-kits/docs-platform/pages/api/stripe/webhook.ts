import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import type { ApiHandler } from '@kvantjs/ryvax.js';

export const POST: ApiHandler = async (context) => {
  const secret = context.env.STRIPE_SECRET_KEY;
  const webhookSecret = context.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) return { status: 503, json: { error: 'Stripe webhook is not configured.' } };
  const signature = typeof context.headers['stripe-signature'] === 'string' ? context.headers['stripe-signature'] : undefined;
  const rawBody = (context as typeof context & { rawBody?: string }).rawBody;
  if (!signature || rawBody === undefined) return { status: 400, json: { error: 'Missing Stripe signature or raw body.' } };
  const stripe = new Stripe(secret);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret); }
  catch (error) { return { status: 400, json: { error: error instanceof Error ? error.message : 'Invalid Stripe signature.' } }; }

  const object = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
  const metadata = object.metadata ?? {};
  const userId = metadata.user_id;
  if (userId && context.env.SUPABASE_URL && context.env.SUPABASE_SERVICE_ROLE_KEY && (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted')) {
    const admin = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const subscription = event.type === 'checkout.session.completed' ? (object as Stripe.Checkout.Session).subscription : (object as Stripe.Subscription);
    await admin.from('subscriptions').upsert({ user_id: userId, stripe_customer_id: typeof (object as Stripe.Checkout.Session).customer === 'string' ? (object as Stripe.Checkout.Session).customer : null, stripe_subscription_id: typeof subscription === 'string' ? subscription : subscription?.id ?? null, status: event.type === 'customer.subscription.deleted' ? 'canceled' : (subscription as Stripe.Subscription | null)?.status ?? 'active', updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  }
  return { json: { received: true, type: event.type } };
};
