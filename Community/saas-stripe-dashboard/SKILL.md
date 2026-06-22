---
name: saas-stripe-dashboard
description: Build SaaS applications with Stripe payment processing — checkout flows, webhook event handling, real-time metrics dashboards, subscription management, and revenue analytics. Use when the user wants to create a payment-enabled web app, subscription product, revenue dashboard, MRR/ARR tracking, or any product that needs to accept and track recurring or one-time payments via Stripe. Triggers on "Stripe dashboard", "subscription app", "payment processing", "MRR dashboard", "checkout flow", "Stripe webhooks", "billing", or any "build me a SaaS" request that involves payments.
compatibility: Requires Node.js 18+ or Bun 1.2+, Stripe account. Works with any web framework. Templates included for Drizzle ORM + MySQL.
metadata:
  author: titancomerce.zo.computer
  category: Community
  display-name: SaaS Stripe Dashboard
  emoji: 💳
---

# SaaS Stripe Dashboard Skill

Build production-ready business dashboards with live payment processing, webhook handling, and real-time data integration.

**Usage:** Read this SKILL.md top to bottom, then copy templates from `templates/` into your project and customize. Run `bun scripts/test-webhooks-advanced.mjs` to verify your webhook setup end-to-end.

## Overview

This skill provides a complete workflow for building SaaS applications with Stripe payment processing, webhook event handling, real-time metrics dashboards, and third-party integrations (Google Drive, email, notifications).

## When to Use This Skill

Use when building:
- **Payment-enabled web applications** - SaaS platforms, marketplaces, digital products
- **Business metrics dashboards** - Revenue tracking, payment analytics, performance monitoring
- **Subscription management systems** - Recurring billing, plan upgrades/downgrades
- **Payment processing workflows** - Checkout flows, payment history, receipts
- **Multi-tier pricing models** - Tiered products, promotional codes, discounts

## Quick Start (5 Steps)

### Step 1: Initialize Project
```bash
webdev_init_project --name my-saas-app --features db,server,user
```

### Step 2: Set Up Database
```bash
cp templates/drizzle-schema-template.ts drizzle/schema.ts
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### Step 3: Configure Products
```bash
cp templates/products-template.ts server/products.ts
# Edit to define your pricing tiers
```

### Step 4: Implement Webhooks
```bash
cp templates/stripe-webhook-template.ts server/stripe.ts
# Register webhook endpoint in server/_core/index.ts
```

### Step 5: Test Webhooks
```bash
node scripts/test-webhooks-advanced.mjs
```

## Payment Flow

```
User selects plan → tRPC.payments.createCheckout 
→ Stripe.checkout.sessions.create() 
→ Redirect to Stripe Checkout 
→ User enters: 4242 4242 4242 4242 (card) + CVC + exp date
→ Stripe processes payment 
→ Webhook: checkout.session.completed 
→ Server creates payment record 
→ Owner notification triggered 
→ Dashboard updates
```

## Webhook Events (3 Critical Events)

| Event | Trigger | Action |
|-------|---------|--------|
| `checkout.session.completed` | Successful checkout | Create payment record, notify owner |
| `payment_intent.succeeded` | Payment intent succeeds | Persist payment, update status |
| `payment_intent.payment_failed` | Card declined/error | Create failed record, notify owner |

## Database Schema

**Payments Table** (use `templates/drizzle-schema-template.ts`):
- `sessionId` (unique) - Stripe session or payment intent ID
- `userId` - User who made payment
- `amount` - Payment amount in dollars
- `currency` - Currency code (USD, EUR, etc.)
- `status` - pending, completed, failed, canceled
- `customerEmail` - Email for receipt
- `customerName` - Display name
- `stripePaymentIntentId` - Stripe payment intent ID
- `metadata` - JSON with product, card details, etc.

## Test Cards & Validation

**Test Cards:**

| Card | Number | CVC | Exp | Result |
|------|--------|-----|-----|--------|
| Visa Success | 4242 4242 4242 4242 | Any 3 | Any future | ✅ Succeeds |
| Visa Declined | 4000 0000 0000 0002 | Any 3 | Any future | ❌ Fails |
| Amex | 3782 822463 10005 | Any 4 | Any future | ✅ Succeeds |
| Mastercard | 5555 5555 5555 4444 | Any 3 | Any future | ✅ Succeeds |

**CVC Validation:**
- Visa/Mastercard: 3 digits (e.g., 123)
- Amex: 4 digits (e.g., 1234)

**Expiration Date Validation:**
- Format: MM/YYYY (e.g., 12/2025)
- Must be future date
- Month: 01-12, Year: current or later

## Advanced Testing

Use the included test suite with card validation:

```bash
node scripts/test-webhooks-advanced.mjs [webhook-url] [webhook-secret]
```

Tests:
- ✅ Card number validation (Luhn algorithm)
- ✅ CVC format validation (3 or 4 digits)
- ✅ Expiration date validation (future date)
- ✅ All webhook event types
- ✅ Different product tiers
- ✅ Success and failure scenarios

## Security Best Practices

1. **Verify webhook signatures** - Always validate with webhook secret
2. **Never store card details** - Stripe handles PCI compliance
3. **Use HTTPS only** - Webhook endpoint must be HTTPS
4. **Store Stripe IDs only** - Save payment intent ID, not amounts
5. **Validate amounts server-side** - Never trust client amounts
6. **Use environment variables** - Never hardcode API keys
7. **Implement idempotency** - Handle webhook retries with unique sessionId
8. **Log webhook events** - Track all events for debugging

## Environment Variables (Auto-Injected)

```
STRIPE_SECRET_KEY              # Server-side secret key
STRIPE_WEBHOOK_SECRET          # Webhook signing secret
VITE_STRIPE_PUBLISHABLE_KEY    # Frontend publishable key
DATABASE_URL                   # MySQL connection string
JWT_SECRET                     # Session cookie signing secret
```

## Deployment

### Manus Hosting
1. `webdev_save_checkpoint`
2. Click "Publish" in Management UI
3. Configure webhook in Stripe Dashboard:
   - Developers → Webhooks → Add endpoint
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events: checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed
   - Copy signing secret to Settings → Payment

## Troubleshooting

**Webhook not processing?**
- Check webhook secret configuration
- Verify endpoint is HTTPS
- Run: `node scripts/test-webhooks-advanced.mjs`
- Check logs: `tail -f .manus-logs/devserver.log`

**Card validation failing?**
- Verify card number (Luhn algorithm)
- Check CVC format (3 or 4 digits)
- Verify expiration date (future date)
- Use test cards from table above

## Resources

- **Payment Architecture** - `references/payment-architecture.md` - Complete payment flow, webhook payloads, security
- **Database Schema** - `templates/drizzle-schema-template.ts` - Ready-to-use schema
- **Products Config** - `templates/products-template.ts` - Pricing tier definitions
- **Webhook Handler** - `templates/stripe-webhook-template.ts` - Event handlers
- **Test Suite** - `scripts/test-webhooks-advanced.mjs` - Comprehensive testing with card validation

## Next Steps

After basic setup:
1. **Add Subscriptions** - Recurring billing with Stripe subscriptions
2. **Email Receipts** - Automated invoice emails on payment
3. **Promo Codes** - Track discount usage and revenue impact
4. **Payment History** - User-facing payment history page
5. **Refunds** - Implement refund processing
6. **Analytics** - Advanced revenue reporting and forecasting
