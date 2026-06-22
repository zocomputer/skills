# Payment Architecture & Stripe Integration

## Core Payment Flow

### 1. Checkout Session Creation
```
User selects plan → Frontend calls tRPC.payments.createCheckout 
→ Server creates Stripe.checkout.sessions.create() 
→ Returns session URL → Frontend opens in new tab 
→ Stripe Checkout hosted page
```

### 2. Payment Processing
```
User enters card details → Stripe processes payment 
→ Webhook event: checkout.session.completed 
→ Server creates payment record in database 
→ Owner notification triggered 
→ Dashboard updates with new payment
```

### 3. Webhook Event Handling
Three critical events must be handled:

| Event | Trigger | Action |
|-------|---------|--------|
| `checkout.session.completed` | Successful checkout | Create payment record, notify owner |
| `payment_intent.succeeded` | Payment intent succeeds | Persist payment, update status |
| `payment_intent.payment_failed` | Card declined or error | Create failed record, notify owner |

## Database Schema

### Payments Table
```sql
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sessionId VARCHAR(255) UNIQUE NOT NULL,
  userId INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'canceled') NOT NULL,
  customerEmail VARCHAR(255) NOT NULL,
  customerName VARCHAR(255),
  stripePaymentIntentId VARCHAR(255),
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);
```

### Users Table Extension
```sql
ALTER TABLE users ADD COLUMN stripeCustomerId VARCHAR(255);
```

## Webhook Signature Verification

Stripe uses HMAC-SHA256 with format: `t={timestamp},v1={signature}`

```typescript
// Correct verification
const event = stripe.webhooks.constructEvent(
  body,           // Raw request body (Buffer)
  signature,      // Stripe-Signature header
  webhookSecret   // From Stripe Dashboard
);

// Test events have format: evt_test_*
if (event.id.startsWith('evt_test_')) {
  return { verified: true };
}
```

## Test Card Numbers

| Card Type | Number | CVC | Exp Date |
|-----------|--------|-----|----------|
| Visa | 4242 4242 4242 4242 | Any 3 digits | Any future date |
| Visa (declined) | 4000 0000 0000 0002 | Any 3 digits | Any future date |
| Amex | 3782 822463 10005 | Any 4 digits | Any future date |
| Mastercard | 5555 5555 5555 4444 | Any 3 digits | Any future date |

**Important:** Test cards work in Stripe test mode only. Live mode requires real card numbers.

## Product Configuration

Centralize pricing in `server/products.ts`:

```typescript
export const PRODUCTS = {
  STARTER: {
    id: "starter",
    name: "Starter",
    description: "Perfect for small businesses",
    price: 2999,        // Amount in cents ($29.99)
    currency: "USD",
  },
  PROFESSIONAL: {
    id: "professional",
    name: "Professional",
    description: "For growing teams",
    price: 7999,        // Amount in cents ($79.99)
    currency: "USD",
  },
  ENTERPRISE: {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions",
    price: 29999,       // Amount in cents ($299.99)
    currency: "USD",
  },
};

export function getProductPrice(productId: string): number | null {
  const product = Object.values(PRODUCTS).find(p => p.id === productId);
  return product?.price ?? null;
}
```

## Webhook Payload Structure

### checkout.session.completed
```json
{
  "id": "evt_1234567890",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_123",
      "amount_total": 2999,
      "currency": "usd",
      "customer_email": "user@example.com",
      "client_reference_id": "1",
      "metadata": {
        "user_id": "1",
        "customer_email": "user@example.com",
        "customer_name": "John Doe",
        "product_id": "starter"
      },
      "payment_intent": "pi_test_123"
    }
  }
}
```

### payment_intent.succeeded
```json
{
  "id": "evt_1234567891",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_test_456",
      "amount": 7999,
      "currency": "usd",
      "status": "succeeded",
      "metadata": {
        "user_id": "1",
        "customer_email": "user@example.com",
        "customer_name": "John Doe",
        "product_id": "professional"
      }
    }
  }
}
```

### payment_intent.payment_failed
```json
{
  "id": "evt_1234567892",
  "type": "payment_intent.payment_failed",
  "data": {
    "object": {
      "id": "pi_test_789",
      "amount": 29999,
      "currency": "usd",
      "status": "requires_payment_method",
      "metadata": {
        "user_id": "1",
        "customer_email": "user@example.com",
        "customer_name": "John Doe",
        "product_id": "enterprise"
      }
    }
  }
}
```

## Idempotent Payment Recording

Prevent duplicate payment records using unique sessionId:

```typescript
// checkout.session.completed
sessionId = session.id  // e.g., "cs_test_123"

// payment_intent.succeeded
sessionId = `pi_${paymentIntent.id}`  // e.g., "pi_pi_test_456"

// payment_intent.payment_failed
sessionId = `pi_failed_${paymentIntent.id}`  // e.g., "pi_failed_pi_test_789"
```

Each sessionId is unique, preventing duplicate records even if webhooks are retried.

## Environment Variables

Required Stripe environment variables (auto-injected in Manus):

```
STRIPE_SECRET_KEY              # Server-side secret key
STRIPE_WEBHOOK_SECRET          # Webhook signing secret
VITE_STRIPE_PUBLISHABLE_KEY    # Frontend publishable key
```

## Owner Notifications

Trigger notifications on payment events:

```typescript
import { notifyOwner } from "./server/_core/notification";

await notifyOwner({
  title: "New Payment Received",
  content: `Payment of $${amount.toFixed(2)} from ${email} completed.`,
});
```

## Real-Time Dashboard Updates

Implement polling for real-time payment feed:

```typescript
const recentPaymentsQuery = trpc.payments.getRecent.useQuery(
  { limit: 8 },
  { refetchInterval: autoRefresh ? 5000 : false }  // 5-second polling
);
```

For true real-time updates, implement WebSocket or Server-Sent Events (SSE).

## Security Best Practices

1. **Never store card details** - Stripe handles PCI compliance
2. **Verify webhook signatures** - Always validate with webhook secret
3. **Use HTTPS only** - Webhook endpoint must be HTTPS
4. **Store Stripe IDs only** - Save `stripePaymentIntentId`, not payment amounts
5. **Validate amounts server-side** - Never trust client-provided amounts
6. **Use environment variables** - Never hardcode API keys
7. **Log webhook events** - Track all events for debugging
8. **Implement idempotency** - Handle webhook retries gracefully

## Testing Checklist

- [ ] Test card 4242 4242 4242 4242 with valid CVC and future date
- [ ] Test declined card 4000 0000 0000 0002
- [ ] Verify webhook signature validation
- [ ] Confirm payment record created in database
- [ ] Verify owner notification triggered
- [ ] Test payment feed updates
- [ ] Verify Google Drive integration
- [ ] Test with different product tiers
- [ ] Verify error handling for invalid webhooks
- [ ] Test webhook retries (idempotency)
