import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { RouteConfig, RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";

// ---------------------------------------------------------------------------
// Single cost control — adjust X402_COST_CENTS to set the trial price
// ---------------------------------------------------------------------------
const costCents = Number(process.env.X402_COST_CENTS || "100");

export const TRIAL_PRICE = `$${(costCents / 100).toFixed(2)}`;

const walletAddress = process.env.X402_WALLET_ADDRESS || "";
const facilitatorUrl =
  process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";
const network = (process.env.X402_NETWORK || "eip155:84532") as Network;

export function isX402Enabled(): boolean {
  return process.env.X402_ENABLED === "true" && walletAddress !== "";
}

export function isPaidRequest(request: Request): boolean {
  if (!isX402Enabled()) return false;
  return !!(
    request.headers.get("payment-signature") ||
    request.headers.get("x-payment")
  );
}

function makeRouteConfig(price: string, description: string): RouteConfig {
  return {
    accepts: {
      scheme: "exact",
      price,
      network,
      payTo: walletAddress,
    },
    description,
    mimeType: "application/json",
  };
}

// Lazy-initialized server — only created when x402 is enabled
let _server: x402ResourceServer | null = null;

export function getX402Server(): x402ResourceServer {
  if (!_server) {
    const facilitatorClient = new HTTPFacilitatorClient({
      url: facilitatorUrl,
    });
    _server = new x402ResourceServer(facilitatorClient);
    _server.register(network, new ExactEvmScheme());
  }
  return _server;
}

export function getRoutesConfig(): RoutesConfig {
  return {
    "POST /api/trial": makeRouteConfig(
      TRIAL_PRICE,
      "Create a token debate trial"
    ),
  };
}
