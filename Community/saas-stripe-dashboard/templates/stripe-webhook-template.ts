import Stripe from "stripe";
import { createPayment, updatePaymentStatus } from "./db";
import { notifyOwner } from "./_core/notification";
import { PRODUCTS } from "./products";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * Handle checkout.session.completed webhook event
 * 
 * This event fires when a customer completes the Stripe Checkout flow.
 * Creates a payment record and triggers owner notification.
 */
export async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  const userId = session.client_reference_id ? parseInt(session.client_reference_id) : 0;
  const amount = session.amount_total ? session.amount_total / 100 : 0;
  const customerEmail = session.customer_email || "unknown@example.com";
  const customerName = session.metadata?.customer_name || "Unknown";
  const productId = session.metadata?.product_id || "unknown";

  // Create payment record
  await createPayment({
    sessionId: session.id,
    userId,
    amount: amount.toString(),
    currency: (session.currency || "USD").toUpperCase(),
    status: "completed",
    customerEmail,
    customerName,
    stripePaymentIntentId: session.payment_intent as string,
    metadata: JSON.stringify({
      ...session.metadata,
      event_type: "checkout.session.completed",
      session_id: session.id,
    }),
  });

  // Notify owner
  await notifyOwner({
    title: "💰 New Payment Received",
    content: `Payment of $${amount.toFixed(2)} from ${customerEmail} (${customerName}) - ${productId} plan completed. Session: ${session.id}`,
  });

  console.log(`[Stripe] checkout.session.completed: ${session.id} - $${amount.toFixed(2)}`);
}

/**
 * Handle payment_intent.succeeded webhook event
 * 
 * This event fires when a payment intent succeeds.
 * Creates or updates payment record for successful payment intent.
 */
export async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  const metadata = paymentIntent.metadata || {};
  const userId = metadata.user_id ? parseInt(metadata.user_id) : 0;
  const customerEmail = metadata.customer_email || "unknown@example.com";
  const customerName = metadata.customer_name || "Unknown";
  const amount = paymentIntent.amount ? paymentIntent.amount / 100 : 0;

  // Create payment record if not already created by checkout.session.completed
  if (userId > 0 && customerEmail) {
    const sessionId = `pi_${paymentIntent.id}`;
    
    await createPayment({
      sessionId,
      userId,
      amount: amount.toString(),
      currency: (paymentIntent.currency || "USD").toUpperCase(),
      status: "completed",
      customerEmail,
      customerName,
      stripePaymentIntentId: paymentIntent.id,
      metadata: JSON.stringify({
        ...metadata,
        event_type: "payment_intent.succeeded",
        payment_intent_id: paymentIntent.id,
      }),
    });
  }

  console.log(`[Stripe] payment_intent.succeeded: ${paymentIntent.id} - $${amount.toFixed(2)}`);
}

/**
 * Handle payment_intent.payment_failed webhook event
 * 
 * This event fires when a payment intent fails.
 * Creates failed payment record and notifies owner.
 */
export async function handlePaymentIntentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  const metadata = paymentIntent.metadata || {};
  const userId = metadata.user_id ? parseInt(metadata.user_id) : 0;
  const customerEmail = metadata.customer_email || "unknown@example.com";
  const customerName = metadata.customer_name || "Unknown";
  const amount = paymentIntent.amount ? paymentIntent.amount / 100 : 0;

  // Create failed payment record
  if (userId > 0 && customerEmail) {
    const sessionId = `pi_failed_${paymentIntent.id}`;
    
    await createPayment({
      sessionId,
      userId,
      amount: amount.toString(),
      currency: (paymentIntent.currency || "USD").toUpperCase(),
      status: "failed",
      customerEmail,
      customerName,
      stripePaymentIntentId: paymentIntent.id,
      metadata: JSON.stringify({
        ...metadata,
        event_type: "payment_intent.payment_failed",
        payment_intent_id: paymentIntent.id,
        failure_code: paymentIntent.last_payment_error?.code,
        failure_message: paymentIntent.last_payment_error?.message,
      }),
    });

    // Notify owner of failure
    await notifyOwner({
      title: "⚠️ Payment Failed",
      content: `Payment of $${amount.toFixed(2)} from ${customerEmail} (${customerName}) failed. Reason: ${paymentIntent.last_payment_error?.message || "Unknown"}`,
    });
  }

  console.log(`[Stripe] payment_intent.payment_failed: ${paymentIntent.id} - $${amount.toFixed(2)}`);
}

/**
 * Verify Stripe webhook signature
 * 
 * CRITICAL: Always verify signatures to ensure webhooks are from Stripe
 */
export function verifyWebhookSignature(
  body: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(body, signature, secret);
}

/**
 * Handle test events (evt_test_*)
 * 
 * Test events should be verified but not processed
 */
export function isTestEvent(event: Stripe.Event): boolean {
  return event.id.startsWith("evt_test_");
}
