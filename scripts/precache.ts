/**
 * Pre-cache script for popular tokens.
 * Warms Nansen CLI cache and supplementary API caches so demo trials run fast.
 *
 * Usage: pnpm precache
 */

import { fetchBullData } from "@/lib/agents/bull";
import { fetchBearData } from "@/lib/agents/bear";
import { fetchJudgeData } from "@/lib/agents/judge";

// Popular Solana tokens for demo
const DEMO_TOKENS: Array<{
  address: string;
  chain: string;
  name: string;
}> = [
  {
    address: "So11111111111111111111111111111111111111112",
    chain: "solana",
    name: "Wrapped SOL",
  },
  {
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    chain: "solana",
    name: "Jupiter",
  },
  {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    chain: "solana",
    name: "USD Coin",
  },
  {
    address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    chain: "solana",
    name: "dogwifhat",
  },
  {
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    chain: "solana",
    name: "Bonk",
  },
];

async function precacheToken(token: (typeof DEMO_TOKENS)[number]) {
  const start = Date.now();
  console.log(`\n  Caching ${token.name} (${token.chain})...`);

  const results = await Promise.allSettled([
    fetchBullData(token.address, token.chain),
    fetchBearData(token.address, token.chain),
    fetchJudgeData(token.address, token.chain),
  ]);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(
    `  Done: ${succeeded}/3 agents cached, ${failed} failed (${elapsed}s)`
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.log(`    Error: ${result.reason?.message ?? result.reason}`);
    }
  }
}

async function main() {
  console.log("Alpha Court — Pre-cache Script");
  console.log(`Warming cache for ${DEMO_TOKENS.length} tokens...\n`);

  const totalStart = Date.now();

  for (const token of DEMO_TOKENS) {
    await precacheToken(token);
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log(`\nDone! Total time: ${totalElapsed}s`);
}

main().catch((err) => {
  console.error("Pre-cache failed:", err);
  process.exit(1);
});
