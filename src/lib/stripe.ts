import "dotenv/config";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
    })
  : null;

if (!stripe && process.env.NODE_ENV === "production") {
  console.warn(
    "STRIPE_SECRET_KEY is not defined. Stripe features will be unavailable.",
  );
}

export const PLANS = {
  BASIC: {
    name: "Intelligence (Basic)",
    priceId: "", // Free
    price: 0,
  },
  PLUS: {
    name: "Intelligence PLUS",
    priceId: process.env.STRIPE_PLUS_PRICE_ID || "price_plus_placeholder",
    price: 4900, // $49.00
  },
};
