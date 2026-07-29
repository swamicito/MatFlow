"use server";

import { getStripe } from "@/lib/stripe";

export type SessionInfo = {
  gymName:    string | null;
  ownerEmail: string | null;
  plan:       string | null;
  interval:   string | null;
};

export async function getSignupSessionInfo(sessionId: string): Promise<SessionInfo | null> {
  console.log("[confirmed/actions] getSignupSessionInfo called, sessionId:", sessionId);

  const blank: SessionInfo = { gymName: null, ownerEmail: null, plan: null, interval: null };

  if (!sessionId || typeof sessionId !== "string") {
    console.warn("[confirmed/actions] No sessionId provided");
    return blank;
  }

  try {
    const stripe = getStripe();
    if (!stripe) {
      console.warn("[confirmed/actions] Stripe not configured — returning blank info");
      return blank;
    }

    console.log("[confirmed/actions] Calling stripe.checkout.sessions.retrieve...");
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log("[confirmed/actions] Session retrieved, metadata:", JSON.stringify(session.metadata));

    return {
      gymName:    session.metadata?.gym_name    ?? null,
      ownerEmail: session.metadata?.owner_email ?? session.customer_email ?? null,
      plan:       session.metadata?.matflow_plan     ?? null,
      interval:   session.metadata?.matflow_interval ?? null,
    };
  } catch (err) {
    console.error("[confirmed/actions] stripe.checkout.sessions.retrieve failed:", err);
    return blank;
  }
}
