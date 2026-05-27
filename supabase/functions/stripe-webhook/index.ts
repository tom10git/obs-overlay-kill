import Stripe from 'npm:stripe@17.7.0'
import { upsertSubscriptionFromStripe } from '../_shared/billing/stripe-sync.ts'
import { createSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { getStripe } from '../_shared/stripe.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!secret) {
    return new Response('webhook_not_configured', { status: 503 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return new Response('no_signature', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret)
  } catch (e) {
    console.error('[billing] webhook signature', e)
    return new Response('invalid_signature', { status: 400 })
  }

  const admin = createSupabaseAdmin()

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await upsertSubscriptionFromStripe(
          admin,
          event.data.object as Stripe.Subscription,
        )
        break
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await getStripe().subscriptions.retrieve(
            session.subscription as string,
          )
          await upsertSubscriptionFromStripe(admin, sub)
        }
        break
      }
      default:
        break
    }
  } catch (e) {
    console.error('[billing] webhook handler', event.type, e)
    return new Response('handler_failed', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
