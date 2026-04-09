import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { RouteConfig, RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { SignJWT, importPKCS8 } from "jose";

// ---------------------------------------------------------------------------
// Single cost control — adjust X402_COST_CENTS to set the trial price
// ---------------------------------------------------------------------------
export const COST_CENTS = Number(process.env.X402_COST_CENTS || "100");

export const TRIAL_PRICE = `$${(COST_CENTS / 100).toFixed(2)}`;

const walletAddress = process.env.X402_WALLET_ADDRESS || "";
export const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";
export const NETWORK = (process.env.X402_NETWORK || "eip155:84532") as Network;

// ---------------------------------------------------------------------------
// CDP Facilitator Auth (required for Base mainnet via api.cdp.coinbase.com)
// ---------------------------------------------------------------------------
const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || "";
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET || "";

const CDP_FACILITATOR_HOST = "api.cdp.coinbase.com";
const CDP_FACILITATOR_BASE_PATH = "/platform/v2/x402";

// Ed25519 PKCS8 PEM prefix (DER header for a 32-byte Ed25519 seed)
const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
  0x04, 0x22, 0x04, 0x20,
]);

let _cdpKey: CryptoKey | null = null;

async function getCdpKey(): Promise<CryptoKey> {
  if (_cdpKey) return _cdpKey;
  // Decode base64 secret → 64 bytes (32 seed + 32 public), take seed only
  const raw = Uint8Array.from(atob(CDP_API_KEY_SECRET), (c) => c.charCodeAt(0));
  const derBytes = new Uint8Array(ED25519_PKCS8_PREFIX.length + 32);
  derBytes.set(ED25519_PKCS8_PREFIX);
  derBytes.set(raw.subarray(0, 32), ED25519_PKCS8_PREFIX.length);

  // Convert DER to PEM
  const b64 = btoa(String.fromCharCode(...derBytes));
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`;

  _cdpKey = await importPKCS8(pem, "EdDSA");
  return _cdpKey;
}

async function createCdpJWT(method: string, path: string): Promise<string> {
  const key = await getCdpKey();
  const nonceBytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(nonceBytes);
  const nonce = Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const uri = `${method} ${CDP_FACILITATOR_HOST}${CDP_FACILITATOR_BASE_PATH}${path}`;

  return new SignJWT({ sub: CDP_API_KEY_ID, iss: "cdp", uris: [uri] })
    .setProtectedHeader({ alg: "EdDSA", kid: CDP_API_KEY_ID, nonce, typ: "JWT" })
    .setIssuedAt()
    .setNotBefore(Math.floor(Date.now() / 1000))
    .setExpirationTime("2m")
    .sign(key);
}

function createCdpAuthHeaders() {
  return async () => {
    const [verifyJwt, settleJwt, supportedJwt] = await Promise.all([
      createCdpJWT("POST", "/verify"),
      createCdpJWT("POST", "/settle"),
      createCdpJWT("GET", "/supported"),
    ]);
    return {
      verify: { Authorization: `Bearer ${verifyJwt}` },
      settle: { Authorization: `Bearer ${settleJwt}` },
      supported: { Authorization: `Bearer ${supportedJwt}` },
    };
  };
}

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
      network: NETWORK,
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
    const useCdpAuth = CDP_API_KEY_ID !== "" && CDP_API_KEY_SECRET !== "";
    const facilitatorClient = new HTTPFacilitatorClient({
      url: FACILITATOR_URL,
      ...(useCdpAuth ? { createAuthHeaders: createCdpAuthHeaders() } : {}),
    });
    _server = new x402ResourceServer(facilitatorClient);
    _server.register(NETWORK, new ExactEvmScheme());
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
