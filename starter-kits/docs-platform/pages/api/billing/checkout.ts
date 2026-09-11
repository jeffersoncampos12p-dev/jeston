import Stripe from 'stripe';
import type { ApiHandler } from '@kvantjs/ryvax.js';
import { currentUser, demoMode, formValue, siteUrl } from '../../../src/services.js';

export const POST: ApiHandler = async (context) => {
  const user = await currentUser(context);
  if (!user || user.demo) return { status: 303, redirect: '/login?message=connect-auth' };
  const secret = context.env.STRIPE_SECRET_KEY;
  const price = context.env.STRIPE_PRO_PRICE_ID;
  if (!secret || !price) return { status: 503, json: { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID.' } };
  const plan = formValue(context.body, 'plan') || 'pro';
  if (plan !== 'pro') return { status: 400, json: { error: 'Unknown plan.' } };
  try {
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      success_url: `${siteUrl(context.env)}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl(context.env)}/pricing`,
      metadata: { user_id: user.id, plan },
      subscription_data: { metadata: { user_id: user.id, plan } }
    });
    return session.url ? { status: 303, redirect: session.url } : { status: 502, json: { error: 'Stripe did not return a Checkout URL.' } };
  } catch (error) {
    return { status: 502, json: { error: error instanceof Error ? error.message : 'Could not create Checkout session.' } };
  }
};

