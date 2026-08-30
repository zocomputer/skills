/**
 * Product Configuration for Stripe Checkout
 * 
 * All pricing is defined here and used consistently across:
 * - Stripe checkout session creation
 * - Dashboard display
 * - Payment records
 * 
 * Prices are in cents (multiply USD by 100)
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // Amount in cents
  currency: string;
  features?: string[];
}

export const PRODUCTS: Record<string, Product> = {
  STARTER: {
    id: "starter",
    name: "Starter",
    description: "Perfect for small businesses",
    price: 2999, // $29.99
    currency: "USD",
    features: [
      "Up to 100 transactions/month",
      "Basic analytics",
      "Email support",
    ],
  },
  PROFESSIONAL: {
    id: "professional",
    name: "Professional",
    description: "For growing teams",
    price: 7999, // $79.99
    currency: "USD",
    features: [
      "Up to 1,000 transactions/month",
      "Advanced analytics",
      "Priority support",
      "Custom branding",
    ],
  },
  ENTERPRISE: {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions",
    price: 29999, // $299.99
    currency: "USD",
    features: [
      "Unlimited transactions",
      "Real-time reporting",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
};

/**
 * Get product by ID
 */
export function getProduct(productId: string): Product | undefined {
  return Object.values(PRODUCTS).find(p => p.id === productId);
}

/**
 * Get product price in cents
 */
export function getProductPrice(productId: string): number | null {
  const product = getProduct(productId);
  return product?.price ?? null;
}

/**
 * Get product price in dollars (for display)
 */
export function getProductPriceInDollars(productId: string): string | null {
  const price = getProductPrice(productId);
  if (!price) return null;
  return (price / 100).toFixed(2);
}

/**
 * Get all product IDs
 */
export function getAllProductIds(): string[] {
  return Object.values(PRODUCTS).map(p => p.id);
}

/**
 * Validate product ID
 */
export function isValidProductId(productId: string): boolean {
  return getAllProductIds().includes(productId);
}

/**
 * Get product display name
 */
export function getProductName(productId: string): string | null {
  const product = getProduct(productId);
  return product?.name ?? null;
}
