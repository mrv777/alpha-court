import { getDb } from "@/lib/db";
import { buildVerdictCardHtml, type VerdictCardData } from "@/components/verdict-card";

// In-memory cache for generated images
const imageCache = new Map<string, { png: Buffer; generatedAt: number }>();
const IMAGE_CACHE_TTL = 300_000; // 5 minutes

// Track in-flight renders to prevent concurrent double-render
const pendingRenders = new Map<string, Promise<Buffer>>();

// Fallback 1x1 transparent PNG
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

interface TrialRow {
  id: string;
  token_name: string | null;
  token_symbol: string | null;
  chain: string;
  status: string;
  verdict_score: number | null;
  verdict_label: string | null;
  verdict_summary: string | null;
  bull_conviction: number | null;
  bear_conviction: number | null;
  safety_score: string | null;
  safety_details_json: string | null;
}

async function renderImage(trialId: string, data: VerdictCardData): Promise<Buffer> {
  // Check for in-flight render
  const pending = pendingRenders.get(trialId);
  if (pending) return pending;

  const renderPromise = (async () => {
    let browser;
    try {
      const puppeteer = await import("puppeteer");
      browser = await puppeteer.default.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });

      const html = buildVerdictCardHtml(data);
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 8000 });

      const png = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: 1200, height: 630 },
      });

      return Buffer.from(png);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
      pendingRenders.delete(trialId);
    }
  })();

  pendingRenders.set(trialId, renderPromise);
  return renderPromise;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trialId } = await params;

  // Check image cache
  const cached = imageCache.get(trialId);
  if (cached && Date.now() - cached.generatedAt < IMAGE_CACHE_TTL) {
    return new Response(cached.png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  }

  // Fetch trial data
  const trial = getDb()
    .prepare(
      `SELECT id, token_name, token_symbol, chain, status,
              verdict_score, verdict_label, verdict_summary,
              bull_conviction, bear_conviction,
              safety_score, safety_details_json
       FROM trials WHERE id = ?`
    )
    .get(trialId) as TrialRow | undefined;

  if (!trial || trial.status !== "completed" || trial.verdict_score === null) {
    return new Response(FALLBACK_PNG, {
      status: 404,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache",
      },
    });
  }

  let safetyReasons: string[] = [];
  if (trial.safety_details_json) {
    try {
      const parsed = JSON.parse(trial.safety_details_json);
      if (Array.isArray(parsed)) safetyReasons = parsed;
      else if (parsed?.reasons) safetyReasons = parsed.reasons;
    } catch {
      // Ignore parse errors
    }
  }

  const cardData: VerdictCardData = {
    tokenName: trial.token_name ?? "Unknown Token",
    tokenSymbol: trial.token_symbol,
    chain: trial.chain,
    score: trial.verdict_score,
    label: trial.verdict_label ?? "HOLD",
    summary: trial.verdict_summary ?? "",
    bullConviction: trial.bull_conviction ?? 50,
    bearConviction: trial.bear_conviction ?? 50,
    safety: trial.safety_score ?? "clean",
    safetyReasons,
  };

  try {
    const png = await renderImage(trialId, cardData);

    // Cache the result
    imageCache.set(trialId, { png, generatedAt: Date.now() });

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("Puppeteer render failed:", err);

    // Serve stale cache if available
    if (cached) {
      return new Response(cached.png, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    // Last resort: fallback image
    return new Response(FALLBACK_PNG, {
      status: 500,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache",
      },
    });
  }
}
