#!/usr/bin/env node

/**
 * Advanced Stripe Webhook Test Suite
 * Tests webhook events with card validation, CVC verification, and expiration date handling.
 * 
 * Usage: node test-webhooks-advanced.mjs [webhook-url] [webhook-secret]
 * 
 * Default values:
 *   webhook-url: http://localhost:3000/api/stripe/webhook
 *   webhook-secret: whsec_test_secret (from environment or default)
 */

import crypto from "crypto";

const WEBHOOK_URL = process.argv[2] || "http://localhost:3000/api/stripe/webhook";
const WEBHOOK_SECRET = process.argv[3] || process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_secret";

/**
 * Test card definitions with validation rules
 */
const TEST_CARDS = {
  VISA_SUCCESS: {
    number: "4242424242424242",
    cvc: "123",
    expMonth: "12",
    expYear: "2025",
    brand: "visa",
    description: "Visa - Always succeeds",
  },
  VISA_DECLINED: {
    number: "4000000000000002",
    cvc: "456",
    expMonth: "06",
    expYear: "2026",
    brand: "visa",
    description: "Visa - Always declined",
  },
  AMEX: {
    number: "378282246310005",
    cvc: "7890",
    expMonth: "03",
    expYear: "2027",
    brand: "amex",
    description: "Amex - 4-digit CVC",
  },
  MASTERCARD: {
    number: "5555555555554444",
    cvc: "789",
    expMonth: "09",
    expYear: "2024",
    brand: "mastercard",
    description: "Mastercard - Standard",
  },
};

/**
 * Validate card number using Luhn algorithm
 */
function validateCardNumber(cardNumber) {
  const digits = cardNumber.replace(/\D/g, "");
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Validate CVC format
 */
function validateCVC(cvc, cardBrand) {
  if (cardBrand === "amex") {
    return /^\d{4}$/.test(cvc);
  }
  return /^\d{3}$/.test(cvc);
}

/**
 * Validate expiration date
 */
function validateExpirationDate(month, year) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const expYear = parseInt(year, 10);
  const expMonth = parseInt(month, 10);

  if (expYear < currentYear) {
    return false;
  }

  if (expYear === currentYear && expMonth < currentMonth) {
    return false;
  }

  if (expMonth < 1 || expMonth > 12) {
    return false;
  }

  return true;
}

/**
 * Validate card details
 */
function validateCardDetails(card) {
  const errors = [];

  if (!validateCardNumber(card.number)) {
    errors.push(`Invalid card number (failed Luhn check)`);
  }

  if (!validateCVC(card.cvc, card.brand)) {
    errors.push(
      `Invalid CVC for ${card.brand} (expected ${card.brand === "amex" ? "4" : "3"} digits, got ${card.cvc.length})`
    );
  }

  if (!validateExpirationDate(card.expMonth, card.expYear)) {
    errors.push(`Card expired or invalid expiration date (${card.expMonth}/${card.expYear})`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a valid Stripe webhook signature
 */
function createSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedContent = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedContent)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

/**
 * Send a webhook event
 */
async function sendWebhookEvent(eventType, eventData) {
  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    type: eventType,
    data: eventData,
  });

  const signature = createSignature(payload, WEBHOOK_SECRET);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body: payload,
    });

    const text = await response.text();
    return {
      status: response.status,
      success: response.status === 200,
      response: text,
    };
  } catch (error) {
    return {
      status: 0,
      success: false,
      response: error.message,
    };
  }
}

/**
 * Test payment with card details
 */
async function testPaymentWithCard(card, productId = "starter") {
  console.log(`\n💳 Testing Card: ${card.description}`);
  console.log(`   Card Number: ${card.number.slice(-4).padStart(card.number.length, "*")}`);
  console.log(`   CVC: ${card.cvc}`);
  console.log(`   Exp: ${card.expMonth}/${card.expYear}`);

  // Validate card details
  const validation = validateCardDetails(card);
  if (!validation.valid) {
    console.log(`   ❌ Card validation failed:`);
    validation.errors.forEach(err => console.log(`      - ${err}`));
    return false;
  }
  console.log(`   ✅ Card validation passed`);

  // Determine expected outcome
  const shouldSucceed = card.brand !== "visa" || card.number !== TEST_CARDS.VISA_DECLINED.number;
  const eventType = shouldSucceed ? "checkout.session.completed" : "payment_intent.payment_failed";

  // Create webhook event
  const eventData = {
    object: {
      id: `cs_test_${Date.now()}`,
      amount_total: 2999,
      currency: "usd",
      customer_email: "test@example.com",
      client_reference_id: "1",
      metadata: {
        user_id: "1",
        customer_email: "test@example.com",
        customer_name: "Test User",
        product_id: productId,
        card_brand: card.brand,
        card_last4: card.number.slice(-4),
        card_cvc_validated: true,
        card_exp_validated: true,
      },
      payment_intent: `pi_test_${Date.now()}`,
    },
  };

  // Send webhook
  const result = await sendWebhookEvent(eventType, eventData);

  if (result.success) {
    console.log(`   ✅ Webhook processed (${result.status})`);
    return true;
  } else {
    console.log(`   ❌ Webhook failed (${result.status}): ${result.response}`);
    return false;
  }
}

/**
 * Run comprehensive test suite
 */
async function runTests() {
  console.log("🧪 Advanced Stripe Webhook Test Suite");
  console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);
  console.log(`🔐 Using webhook secret: ${WEBHOOK_SECRET.substring(0, 20)}...`);
  console.log(`\n📋 Test Cards:`);

  // Display test cards
  Object.entries(TEST_CARDS).forEach(([key, card]) => {
    console.log(`   ${key}: ${card.description}`);
  });

  const results = [];

  // Test each card
  for (const [key, card] of Object.entries(TEST_CARDS)) {
    const passed = await testPaymentWithCard(card);
    results.push({ name: key, description: card.description, passed });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test with different product tiers
  console.log(`\n💰 Testing Different Product Tiers:`);
  const tiers = [
    { id: "starter", name: "Starter ($29.99)" },
    { id: "professional", name: "Professional ($79.99)" },
    { id: "enterprise", name: "Enterprise ($299.99)" },
  ];

  for (const tier of tiers) {
    const passed = await testPaymentWithCard(TEST_CARDS.VISA_SUCCESS, tier.id);
    results.push({ name: `tier_${tier.id}`, description: tier.name, passed });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log(`\n📊 Test Results Summary:`);
  console.log(`${"=".repeat(50)}`);

  const passCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  results.forEach(result => {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} - ${result.description}`);
  });

  console.log(`${"=".repeat(50)}`);
  console.log(`\n📈 Overall: ${passCount}/${totalCount} tests passed`);

  if (passCount === totalCount) {
    console.log(`✅ All tests passed! Payment system is ready for production.`);
    process.exit(0);
  } else {
    console.log(`❌ Some tests failed. Review the errors above.`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error("Test suite error:", error);
  process.exit(1);
});
