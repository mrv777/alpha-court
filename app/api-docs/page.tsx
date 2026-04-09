import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alpha Court — API for Agents",
  description:
    "Pay-per-use API for AI agents via the x402 protocol. Get on-chain token verdicts with USDC micropayments.",
};

const costCents = Number(process.env.X402_COST_CENTS || "100");
const network = process.env.X402_NETWORK || "eip155:84532";
const facilitatorUrl =
  process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";

const trialPrice = `$${(costCents / 100).toFixed(2)}`;

export default function ApiDocsPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://alphacourt.example";

  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-16 pb-12">
      <div className="w-full max-w-2xl space-y-10">
        {/* Header */}
        <div>
          <a
            href="/"
            className="text-xs text-court-text-dim hover:text-court-text-muted transition-colors"
          >
            &larr; Back to Alpha Court
          </a>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight text-court-text">
            API for Agents
          </h1>
          <p className="mt-2 text-court-text-muted">
            AI agents can pay per request to analyze any token via the{" "}
            <a
              href="https://x402.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-court-text transition-colors"
            >
              x402 protocol
            </a>
            . No API keys, no subscriptions &mdash; just USDC micropayments on
            Base.
          </p>
        </div>

        {/* How it works */}
        <section>
          <h2 className="font-heading text-lg font-semibold text-court-text mb-4">
            How it works
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { step: "1", label: "Request", desc: "Call any gated endpoint" },
              { step: "2", label: "402", desc: "Get payment requirements" },
              { step: "3", label: "Pay", desc: "Sign a USDC transfer" },
              { step: "4", label: "Result", desc: "Receive the response" },
            ].map((s) => (
              <div
                key={s.step}
                className="border border-white/[0.06] bg-white/[0.02] p-3 text-center"
              >
                <span className="text-2xl font-bold text-judge">{s.step}</span>
                <p className="mt-1 text-sm font-medium text-court-text">
                  {s.label}
                </p>
                <p className="text-xs text-court-text-dim">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Endpoints */}
        <section>
          <h2 className="font-heading text-lg font-semibold text-court-text mb-4">
            Endpoints
          </h2>
          <div className="space-y-4">
            <EndpointCard
              method="POST"
              path="/api/trial"
              price={trialPrice}
              description="Create a new debate trial for a token. Returns a trialId you can use to stream the debate and fetch the verdict."
              requestBody={`{
  "tokenAddress": "So11111111111111111111111111111111111111112",
  "chain": "solana",
  "tokenName": "Wrapped SOL",
  "tokenSymbol": "SOL"
}`}
              responseBody={`{ "trialId": "abc123xyz", "cooldown": false }`}
            />
            <EndpointCard
              method="GET"
              path="/api/trials?limit=10"
              price="Free"
              description="List recent completed trials. Use the returned trialIds to fetch verdicts. Limit defaults to 10, max 50."
              responseBody={`{
  "trials": [
    { "id": "abc123", "token_address": "So11...", "token_symbol": "SOL",
      "chain": "solana", "verdict_label": "Buy", "verdict_score": 42, ... }
  ],
  "count": 10
}`}
            />
            <EndpointCard
              method="GET"
              path="/api/debate/{trialId}"
              price="Free"
              description="Stream the live debate via Server-Sent Events."
              responseBody={`event: bull_opening
data: {"content": "Based on smart money..."}\n
event: verdict
data: {"score": 42, "label": "Buy"}`}
            />
            <EndpointCard
              method="GET"
              path="/api/verdict/{trialId}"
              price="Free"
              description="Get the final verdict JSON for a completed trial."
              responseBody={`{
  "score": 42,
  "label": "Buy",
  "bullConviction": 78,
  "bearConviction": 35,
  ...
}`}
            />
          </div>
        </section>

        {/* Quick start */}
        <section>
          <h2 className="font-heading text-lg font-semibold text-court-text mb-4">
            Quick start
          </h2>
          <p className="text-sm text-court-text-muted mb-3">
            Install the x402 client SDK and wrap <code className="text-judge">fetch</code>{" "}
            with automatic payment handling:
          </p>
          <pre className="overflow-x-auto bg-white/[0.03] border border-white/[0.06] p-4 text-xs text-court-text font-mono leading-relaxed">
            {`npm install @x402/fetch @x402/core @x402/evm

import { wrapFetch } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(PRIVATE_KEY);
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));
const fetch402 = wrapFetch(fetch, client);

// 1. Create a trial (${trialPrice} USDC — only paid endpoint)
const trial = await fetch402("${appUrl}/api/trial", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tokenAddress: "So11111111111111111111111111111111111111112",
    chain: "solana",
  }),
});
const { trialId } = await trial.json();

// 2. Stream the debate (free)
const debate = await fetch("${appUrl}/api/debate/" + trialId);

// 3. Get the verdict (free)
const verdict = await fetch("${appUrl}/api/verdict/" + trialId);
const result = await verdict.json();`}
          </pre>
        </section>

        {/* Network & pricing */}
        <section>
          <h2 className="font-heading text-lg font-semibold text-court-text mb-4">
            Network &amp; pricing
          </h2>
          <div className="border border-white/[0.06] bg-white/[0.02] p-4 space-y-2 text-sm">
            <Row label="Payment token" value="USDC" />
            <Row label="Network" value={network} />
            <Row label="Facilitator" value={facilitatorUrl} />
            <Row
              label="Pricing"
              value={`Trial ${trialPrice} · Verdict & Debate free`}
            />
            <Row label="Settlement" value="~2 seconds on Base L2" />
          </div>
        </section>

        <footer className="text-center text-xs text-court-text-dim pt-4">
          Powered by the{" "}
          <a
            href="https://x402.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            x402 protocol
          </a>
        </footer>
      </div>
    </main>
  );
}

function EndpointCard({
  method,
  path,
  price,
  description,
  requestBody,
  responseBody,
}: {
  method: string;
  path: string;
  price: string;
  description: string;
  requestBody?: string;
  responseBody?: string;
}) {
  const methodColor =
    method === "POST"
      ? "bg-bull/20 text-bull"
      : "bg-blue-500/20 text-blue-400";

  return (
    <div className="border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`px-2 py-0.5 text-xs font-bold font-mono ${methodColor}`}
        >
          {method}
        </span>
        <code className="text-sm font-mono text-court-text">{path}</code>
        <span className="ml-auto text-xs font-mono text-judge">{price}</span>
      </div>
      <p className="text-sm text-court-text-muted">{description}</p>
      {requestBody && (
        <div>
          <p className="text-xs text-court-text-dim mb-1">Request body</p>
          <pre className="overflow-x-auto bg-black/30 p-2 text-xs font-mono text-court-text-muted">
            {requestBody}
          </pre>
        </div>
      )}
      {responseBody && (
        <div>
          <p className="text-xs text-court-text-dim mb-1">Response</p>
          <pre className="overflow-x-auto bg-black/30 p-2 text-xs font-mono text-court-text-muted">
            {responseBody}
          </pre>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-court-text-dim">{label}</span>
      <span className="text-court-text font-mono text-right">{value}</span>
    </div>
  );
}
