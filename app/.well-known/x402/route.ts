import {
  isX402Enabled,
  TRIAL_PRICE,
  COST_CENTS,
  NETWORK,
  FACILITATOR_URL,
} from "@/lib/x402";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  return Response.json({
    name: "Alpha Court",
    description:
      "AI agents debate crypto tokens using on-chain data. Pay per trial via x402 — no API keys or subscriptions.",
    x402: {
      enabled: isX402Enabled(),
      network: NETWORK,
      facilitatorUrl: FACILITATOR_URL,
      paymentToken: "USDC",
    },
    endpoints: [
      {
        method: "POST",
        path: "/api/trial",
        description: "Create a new debate trial for a token",
        price: TRIAL_PRICE,
        priceCents: COST_CENTS,
        auth: "x402",
        requestBody: {
          tokenAddress: "string (required) — Solana base58 or EVM 0x address",
          chain: "string (optional) — solana | base | ethereum (default: solana)",
          tokenName: "string (optional)",
          tokenSymbol: "string (optional)",
        },
        responses: {
          201: "{ trialId, cooldown: false }",
          429: "Cooldown active — Retry-After header set. Pay via x402 to bypass.",
          400: "Invalid request body or address format",
          409: "Creation conflict — retry",
        },
      },
      {
        method: "GET",
        path: "/api/debate/{trialId}",
        description:
          "Stream the live debate via Server-Sent Events. Events: phase, message_complete, token_stats, verdict, error, done.",
        price: "free",
        auth: "none",
      },
      {
        method: "GET",
        path: "/api/verdict/{trialId}",
        description: "Get the final verdict JSON for a completed trial",
        price: "free",
        auth: "none",
        responses: {
          200: "Verdict with score, label, conviction, safety",
          202: "Trial in progress — Retry-After header set",
          404: "Trial not found",
        },
      },
      {
        method: "GET",
        path: "/api/trials?limit=10",
        description:
          "List recent completed trials. Limit: 1-50, default 10.",
        price: "free",
        auth: "none",
      },
      {
        method: "GET",
        path: "/api/token/search?q={query}&chain={chain}",
        description:
          "Search tokens by name, symbol, or address. Chains: solana, base, ethereum.",
        price: "free",
        auth: "none",
      },
    ],
    workflow: [
      "1. POST /api/trial with tokenAddress and chain (paid via x402)",
      "2. GET /api/debate/{trialId} to stream the live debate via SSE (free)",
      "3. GET /api/verdict/{trialId} to get the final verdict JSON (free)",
    ],
    docsUrl: appUrl ? `${appUrl}/api-docs` : "/api-docs",
  });
}
